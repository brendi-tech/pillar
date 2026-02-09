"""
Audio transcription service using Groq Whisper API.

Provides fallback transcription for YouTube videos and podcasts when native
transcripts are unavailable. Uses FFmpeg (via pydub) for audio preprocessing.
"""
import asyncio
import io
import logging
import tempfile
import uuid
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class TranscriptSegment:
    """A single segment of a transcript with timing information."""
    start: float  # Start time in seconds
    end: float    # End time in seconds
    text: str     # Transcript text for this segment


@dataclass
class TranscriptResult:
    """
    Result of audio/video transcription with optional timestamp segments.

    For backward compatibility, this can be used as a string via str().
    """
    text: str  # Full concatenated transcript text
    segments: list[TranscriptSegment] = field(default_factory=list)

    def __str__(self) -> str:
        """Allow using TranscriptResult as a string for backward compatibility."""
        return self.text

    def __bool__(self) -> bool:
        """Return True if there's transcript text."""
        return bool(self.text)

    @classmethod
    def from_text(cls, text: str) -> "TranscriptResult":
        """Create a TranscriptResult from plain text (no segments)."""
        return cls(text=text, segments=[])

    def to_dict(self) -> dict:
        """Convert to dict for JSON serialization."""
        return {
            "text": self.text,
            "segments": [
                {"start": s.start, "end": s.end, "text": s.text}
                for s in self.segments
            ],
        }


class AudioTranscriptionService:
    """
    Transcribe audio using Groq Whisper API.

    Handles:
    - Downloading audio from URLs
    - Adaptive downsampling to 16kHz mono with tiered bitrate selection
    - Chunking for files that exceed Groq's 100MB limit
    - Uploading to GCS for URL-based transcription (100MB limit vs 25MB direct)
    - Merging chunked transcripts with deduplication

    File size limits (per Groq docs):
    - Direct file upload: 25MB (free tier)
    - URL-based upload: 100MB (paid tier) - we use this via GCS signed URLs
    """

    # Groq's URL-based upload limit for paid tier customers
    # (25MB for direct uploads, but we use URL-based via GCS)
    MAX_FILE_SIZE_MB = 100
    TARGET_SIZE_MB = 95.0  # Target with safety margin
    TARGET_SAMPLE_RATE = 16000  # 16kHz - Whisper resamples to this internally
    CHUNK_TARGET_MINUTES = 25  # Target chunk size
    CHUNK_OVERLAP_SECONDS = 3  # Overlap between chunks for context

    # Bitrate tiers: (min_ratio_needed, bitrate)
    # ratio = TARGET_SIZE_MB / original_size - higher ratio = less compression needed
    BITRATE_TIERS = [
        (0.80, "128k"),  # Need ≤20% reduction - high quality
        (0.60, "96k"),   # Need 20-40% reduction
        (0.40, "64k"),   # Need 40-60% reduction
        (0.00, "32k"),   # Need >60% reduction - maximum compression
    ]

    def __init__(self):
        """Initialize the audio transcription service."""
        pass  # GROQ_API_KEY check happens at transcription time

    async def transcribe_audio_bytes(self, audio_bytes: bytes) -> TranscriptResult:
        """
        Transcribe audio from raw bytes.

        Useful for transcribing extracted audio from video files or
        other sources where audio is already in memory.

        Args:
            audio_bytes: Raw audio bytes (supports mp3, m4a, wav, etc.)

        Returns:
            TranscriptResult with text and timestamped segments
        """
        groq_api_key = getattr(settings, 'GROQ_API_KEY', None)
        if not groq_api_key:
            logger.debug("[AUDIO] GROQ_API_KEY not configured, skipping transcription")
            return TranscriptResult(text="", segments=[])

        if not audio_bytes:
            logger.warning("[AUDIO] Empty audio bytes provided")
            return TranscriptResult(text="", segments=[])

        try:
            size_mb = len(audio_bytes) / (1024 * 1024)
            logger.info(f"[AUDIO] Transcribing audio bytes: {size_mb:.1f}MB")

            # Only downsample if file exceeds Groq's limit (preserves quality)
            if size_mb > self.MAX_FILE_SIZE_MB:
                logger.info(f"[AUDIO] File exceeds {self.MAX_FILE_SIZE_MB}MB, downsampling...")
                audio_bytes = await self._downsample(audio_bytes)
                if not audio_bytes:
                    return TranscriptResult(text="", segments=[])

                size_mb = len(audio_bytes) / (1024 * 1024)

                # If still too large after downsampling, chunk it
                if size_mb > self.MAX_FILE_SIZE_MB:
                    logger.info(f"[AUDIO] Still {size_mb:.1f}MB after downsampling, chunking...")
                    return await self._transcribe_chunked(audio_bytes)

            return await self._transcribe_single(audio_bytes)

        except Exception as e:
            logger.error(f"[AUDIO] Transcription of bytes failed: {e}", exc_info=True)
            return TranscriptResult(text="", segments=[])

    async def transcribe_audio(self, audio_url: str) -> TranscriptResult:
        """
        Transcribe audio from a URL.

        Downloads the audio and uploads to GCS for URL-based transcription,
        supporting Groq's 100MB limit for paid tier. Only downsamples if
        the file exceeds this limit to preserve audio quality.

        Args:
            audio_url: URL to the audio file (podcast enclosure, etc.)

        Returns:
            TranscriptResult with text and timestamped segments
        """
        groq_api_key = getattr(settings, 'GROQ_API_KEY', None)
        if not groq_api_key:
            logger.debug("[AUDIO] GROQ_API_KEY not configured, skipping transcription")
            return TranscriptResult(text="", segments=[])

        try:
            logger.info(f"[AUDIO] Starting transcription for: {audio_url[:100]}...")

            # Download audio
            audio_bytes = await self._download_audio(audio_url)
            if not audio_bytes:
                return TranscriptResult(text="", segments=[])

            size_mb = len(audio_bytes) / (1024 * 1024)
            logger.info(f"[AUDIO] Downloaded size: {size_mb:.1f}MB")

            # Only downsample if file exceeds Groq's limit (preserves quality)
            if size_mb > self.MAX_FILE_SIZE_MB:
                logger.info(f"[AUDIO] File exceeds {self.MAX_FILE_SIZE_MB}MB, downsampling...")
                audio_bytes = await self._downsample(audio_bytes)
                if not audio_bytes:
                    return TranscriptResult(text="", segments=[])

                size_mb = len(audio_bytes) / (1024 * 1024)

                # If still too large after downsampling, chunk it
                if size_mb > self.MAX_FILE_SIZE_MB:
                    logger.info(f"[AUDIO] Still {size_mb:.1f}MB after downsampling, chunking...")
                    return await self._transcribe_chunked(audio_bytes)

            return await self._transcribe_single(audio_bytes)

        except Exception as e:
            logger.error(f"[AUDIO] Transcription failed for {audio_url[:100]}: {e}", exc_info=True)
            return TranscriptResult(text="", segments=[])

    async def transcribe_youtube_video(
        self,
        video_id: str,
        proxy_creds: Optional[tuple[str, str]] = None,
    ) -> TranscriptResult:
        """
        Transcribe a YouTube video by extracting its audio.

        Uses yt-dlp to extract audio stream and transcribes via Whisper.
        Only downsamples if the file exceeds Groq's 100MB limit.

        Args:
            video_id: YouTube video ID
            proxy_creds: Optional tuple of (username, password) for Webshare proxy

        Returns:
            TranscriptResult with text and timestamped segments
        """
        groq_api_key = getattr(settings, 'GROQ_API_KEY', None)
        if not groq_api_key:
            logger.debug("[AUDIO] GROQ_API_KEY not configured, skipping transcription")
            return TranscriptResult(text="", segments=[])

        try:
            logger.info(f"[AUDIO] Extracting audio from YouTube video: {video_id}")

            # Download audio using yt-dlp with proxy (runs in thread pool via asyncio.to_thread)
            audio_bytes = await self._download_youtube_audio(video_id, proxy_creds)
            if not audio_bytes:
                return TranscriptResult(text="", segments=[])

            size_mb = len(audio_bytes) / (1024 * 1024)
            logger.info(f"[AUDIO] YouTube audio size: {size_mb:.1f}MB")

            # Only downsample if file exceeds Groq's limit (preserves quality)
            if size_mb > self.MAX_FILE_SIZE_MB:
                logger.info(f"[AUDIO] File exceeds {self.MAX_FILE_SIZE_MB}MB, downsampling...")
                audio_bytes = await self._downsample(audio_bytes)
                if not audio_bytes:
                    return TranscriptResult(text="", segments=[])

                size_mb = len(audio_bytes) / (1024 * 1024)

                # If still too large after downsampling, chunk it
                if size_mb > self.MAX_FILE_SIZE_MB:
                    logger.info(f"[AUDIO] Still {size_mb:.1f}MB after downsampling, chunking...")
                    return await self._transcribe_chunked(audio_bytes)

            return await self._transcribe_single(audio_bytes)

        except Exception as e:
            logger.error(f"[AUDIO] YouTube transcription failed for {video_id}: {e}", exc_info=True)
            return TranscriptResult(text="", segments=[])

    async def _download_audio(self, url: str) -> Optional[bytes]:
        """Download audio file from URL."""
        import httpx

        try:
            async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()

                content = response.content
                size_mb = len(content) / (1024 * 1024)
                logger.info(f"[AUDIO] Downloaded {size_mb:.1f}MB from {url[:80]}...")

                return content

        except Exception as e:
            logger.error(f"[AUDIO] Failed to download audio from {url[:80]}: {e}", exc_info=True)
            return None

    async def _download_youtube_audio(
        self, video_id: str, proxy_creds: Optional[tuple[str, str]] = None
    ) -> Optional[bytes]:
        """
        Download audio from YouTube video using yt-dlp.

        Args:
            video_id: YouTube video ID
            proxy_creds: Optional tuple of (username, password) for Webshare proxy

        Returns:
            Audio bytes or None if download fails
        """
        import yt_dlp

        url = f"https://www.youtube.com/watch?v={video_id}"

        def _download():
            import os

            # Create a temporary file to store the audio
            with tempfile.NamedTemporaryFile(suffix='.m4a', delete=False) as tmp_file:
                tmp_path = tmp_file.name

            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': tmp_path.replace('.m4a', ''),
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'm4a',
                    'preferredquality': '128',
                }],
                'quiet': True,
                'no_warnings': True,
            }

            # Add proxy if credentials available
            if proxy_creds:
                username, password = proxy_creds
                ydl_opts['proxy'] = f'http://{username}:{password}@p.webshare.io:80'
                logger.info("[AUDIO] Using Webshare proxy for yt-dlp download")
            else:
                logger.info("[AUDIO] No proxy configured for yt-dlp, using direct connection")

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])

                # Read the downloaded file
                # yt-dlp might add extension, check both
                actual_path = tmp_path
                if not os.path.exists(actual_path):
                    actual_path = tmp_path.replace('.m4a', '') + '.m4a'

                if os.path.exists(actual_path):
                    with open(actual_path, 'rb') as f:
                        content = f.read()
                    os.unlink(actual_path)
                    return content
                else:
                    logger.error(f"[AUDIO] Downloaded file not found at {actual_path}")
                    return None

            except Exception as e:
                logger.error(f"[AUDIO] yt-dlp download failed: {e}", exc_info=True)
                # Clean up
                for ext in ['', '.m4a', '.webm', '.mp4']:
                    try_path = tmp_path.replace('.m4a', '') + ext
                    if os.path.exists(try_path):
                        os.unlink(try_path)
                return None

        return await asyncio.to_thread(_download)

    def _select_bitrate(self, original_size_mb: float) -> str:
        """
        Select appropriate bitrate based on how much size reduction is needed.

        Uses tiered approach to preserve quality when possible:
        - Files just over 100MB get high bitrate (128k)
        - Very large files get aggressive compression (32k)
        """
        ratio_needed = self.TARGET_SIZE_MB / original_size_mb

        for min_ratio, bitrate in self.BITRATE_TIERS:
            if ratio_needed >= min_ratio:
                return bitrate

        # Fallback to most aggressive
        return "32k"

    async def _downsample(self, audio_bytes: bytes) -> Optional[bytes]:
        """
        Downsample audio to 16kHz mono with adaptive bitrate selection.

        Always converts to 16kHz mono (Whisper resamples to this internally anyway).
        Selects bitrate based on how much reduction is actually needed to preserve
        quality when possible.

        Uses pydub which wraps FFmpeg.
        """
        from pydub import AudioSegment

        original_size_mb = len(audio_bytes) / (1024 * 1024)

        def _process(bitrate: str):
            try:
                # Load audio from bytes
                audio = AudioSegment.from_file(io.BytesIO(audio_bytes))

                original_duration = len(audio) / 1000  # seconds

                logger.info(
                    f"[AUDIO] Original: {original_size_mb:.1f}MB, "
                    f"{original_duration:.0f}s, "
                    f"{audio.frame_rate}Hz, "
                    f"{audio.channels} channels"
                )

                # Always downsample to 16kHz mono
                # Whisper resamples to 16kHz internally anyway, so no quality loss
                downsampled = audio.set_frame_rate(self.TARGET_SAMPLE_RATE).set_channels(1)

                # Export as mp3 with selected bitrate
                buffer = io.BytesIO()
                downsampled.export(
                    buffer,
                    format="mp3",
                    bitrate=bitrate,
                )
                buffer.seek(0)
                result = buffer.read()

                new_size_mb = len(result) / (1024 * 1024)
                reduction = (1 - new_size_mb / original_size_mb) * 100

                logger.info(
                    f"[AUDIO] Downsampled: {new_size_mb:.1f}MB "
                    f"({reduction:.0f}% reduction, bitrate={bitrate})"
                )

                return result, new_size_mb

            except Exception as e:
                logger.error(f"[AUDIO] Downsampling failed: {e}", exc_info=True)
                return None, 0

        # Select initial bitrate based on file size
        selected_bitrate = self._select_bitrate(original_size_mb)
        logger.info(f"[AUDIO] Selected bitrate {selected_bitrate} for {original_size_mb:.1f}MB file")

        # Try with selected bitrate
        result, new_size_mb = await asyncio.to_thread(_process, selected_bitrate)

        if result is None:
            return None

        # If still too large, retry with lower bitrates
        current_tier_idx = next(
            (i for i, (_, b) in enumerate(self.BITRATE_TIERS) if b == selected_bitrate),
            0
        )

        while new_size_mb > self.TARGET_SIZE_MB and current_tier_idx < len(self.BITRATE_TIERS) - 1:
            current_tier_idx += 1
            next_bitrate = self.BITRATE_TIERS[current_tier_idx][1]
            logger.info(
                f"[AUDIO] Still {new_size_mb:.1f}MB > {self.TARGET_SIZE_MB}MB, "
                f"retrying with {next_bitrate}"
            )
            result, new_size_mb = await asyncio.to_thread(_process, next_bitrate)

            if result is None:
                return None

        return result

    async def _transcribe_single(self, audio_bytes: bytes, time_offset: float = 0.0) -> TranscriptResult:
        """
        Transcribe a single audio file via Groq Whisper API.

        Args:
            audio_bytes: Audio file bytes
            time_offset: Offset to add to all timestamps (for chunked audio)

        Returns:
            TranscriptResult with text and timestamped segments
        """
        try:
            return await self._transcribe_via_groq(audio_bytes, time_offset)
        except Exception as e:
            logger.error(f"[AUDIO] Single transcription failed: {e}", exc_info=True)
            return TranscriptResult(text="", segments=[])

    async def _transcribe_chunked(self, audio_bytes: bytes) -> TranscriptResult:
        """
        Transcribe audio that's too large by chunking at silence points.

        Splits at natural pauses, transcribes each chunk with proper time offsets,
        and merges with deduplication of overlapping regions.

        Returns:
            TranscriptResult with text and timestamped segments
        """
        from pydub import AudioSegment
        from pydub.silence import split_on_silence

        def _chunk():
            try:
                audio = AudioSegment.from_file(io.BytesIO(audio_bytes))

                # Split at silence points
                chunks = split_on_silence(
                    audio,
                    min_silence_len=700,  # 700ms of silence
                    silence_thresh=-40,   # dB threshold
                    keep_silence=500,     # Keep 500ms at chunk edges
                )

                if not chunks:
                    logger.warning("[AUDIO] No chunks created from split_on_silence")
                    return [(audio, 0.0)]  # Return with time offset

                # Merge small chunks and split large ones
                normalized = self._normalize_chunk_sizes(chunks, audio)

                # Calculate time offsets for each chunk
                chunks_with_offsets = []
                current_offset = 0.0
                for chunk in normalized:
                    chunks_with_offsets.append((chunk, current_offset))
                    current_offset += len(chunk) / 1000.0  # pydub uses milliseconds

                return chunks_with_offsets

            except Exception as e:
                logger.error(f"[AUDIO] Chunking failed: {e}", exc_info=True)
                return []

        chunks_with_offsets = await asyncio.to_thread(_chunk)

        if not chunks_with_offsets:
            logger.error("[AUDIO] No chunks to transcribe")
            return TranscriptResult(text="", segments=[])

        logger.info(f"[AUDIO] Processing {len(chunks_with_offsets)} chunks")

        # Transcribe each chunk with proper time offset
        all_segments = []
        text_parts = []

        for i, (chunk, time_offset) in enumerate(chunks_with_offsets):
            logger.info(f"[AUDIO] Transcribing chunk {i+1}/{len(chunks_with_offsets)} (offset: {time_offset:.1f}s)")

            # Export chunk to bytes with adaptive bitrate (use 64k for chunks)
            buffer = io.BytesIO()
            chunk.export(buffer, format="mp3", bitrate="64k")
            buffer.seek(0)
            chunk_bytes = buffer.read()

            result = await self._transcribe_single(chunk_bytes, time_offset=time_offset)
            if result.text:
                text_parts.append(result.text)
                all_segments.extend(result.segments)

        if not text_parts:
            return TranscriptResult(text="", segments=[])

        # Merge text with deduplication
        merged_text = self._merge_transcripts(text_parts)

        # Sort segments by start time (should already be sorted but be safe)
        all_segments.sort(key=lambda s: s.start)

        return TranscriptResult(text=merged_text, segments=all_segments)

    def _normalize_chunk_sizes(self, chunks: list, original_audio) -> list:
        """
        Merge small chunks and ensure none exceed the max size.

        Target: 20-25 minute chunks.
        """
        from pydub import AudioSegment

        target_ms = self.CHUNK_TARGET_MINUTES * 60 * 1000
        max_ms = 30 * 60 * 1000  # 30 minute max
        min_ms = 5 * 60 * 1000   # 5 minute min

        normalized = []
        current_chunk = AudioSegment.empty()

        for chunk in chunks:
            if len(current_chunk) + len(chunk) <= target_ms:
                current_chunk += chunk
            else:
                if len(current_chunk) >= min_ms:
                    normalized.append(current_chunk)
                    current_chunk = chunk
                else:
                    # Current chunk is too small, add this one anyway
                    current_chunk += chunk
                    if len(current_chunk) >= max_ms:
                        normalized.append(current_chunk)
                        current_chunk = AudioSegment.empty()

        # Don't forget the last chunk
        if len(current_chunk) > 0:
            normalized.append(current_chunk)

        # Log chunk sizes
        for i, chunk in enumerate(normalized):
            duration_min = len(chunk) / 60000
            logger.info(f"[AUDIO] Chunk {i+1}: {duration_min:.1f} minutes")

        return normalized

    async def _transcribe_via_groq(self, audio_bytes: bytes, time_offset: float = 0.0) -> TranscriptResult:
        """
        Call Groq Whisper API to transcribe audio with timestamps.

        Uses URL-based upload via GCS for files to support Groq's 100MB limit
        for paid tier customers (vs 25MB for direct file uploads).

        Args:
            audio_bytes: Audio file bytes
            time_offset: Offset to add to all timestamps (for chunked audio)

        Returns:
            TranscriptResult with text and timestamped segments
        """
        from groq import AsyncGroq

        try:
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)

            size_mb = len(audio_bytes) / (1024 * 1024)
            logger.info(f"[AUDIO] Calling Groq Whisper API ({size_mb:.1f}MB)...")

            # Upload to GCS and use URL-based transcription for 100MB limit
            # (vs 25MB for direct file uploads)
            audio_url = await self._upload_audio_to_gcs(audio_bytes)

            if audio_url:
                logger.info("[AUDIO] Using URL-based transcription via GCS")
                # Use verbose_json to get segment timestamps
                transcription = await client.audio.transcriptions.create(
                    url=audio_url,
                    model="whisper-large-v3",
                    response_format="verbose_json",
                )
            else:
                # Fallback to direct upload if GCS upload fails (25MB limit applies)
                DIRECT_UPLOAD_LIMIT_MB = 25.0

                if size_mb > DIRECT_UPLOAD_LIMIT_MB:
                    # Need to downsample to fit under 25MB direct upload limit
                    logger.warning(
                        f"[AUDIO] GCS upload failed and file is {size_mb:.1f}MB > {DIRECT_UPLOAD_LIMIT_MB}MB, "
                        f"downsampling for direct upload..."
                    )
                    # Temporarily adjust target size for direct upload limit
                    original_target = self.TARGET_SIZE_MB
                    self.TARGET_SIZE_MB = DIRECT_UPLOAD_LIMIT_MB - 1.0  # 24MB target
                    try:
                        audio_bytes = await self._downsample(audio_bytes)
                        if not audio_bytes:
                            logger.error("[AUDIO] Failed to downsample for direct upload")
                            return TranscriptResult(text="", segments=[])
                        size_mb = len(audio_bytes) / (1024 * 1024)
                        logger.info(f"[AUDIO] Downsampled to {size_mb:.1f}MB for direct upload")
                    finally:
                        self.TARGET_SIZE_MB = original_target
                else:
                    logger.warning(f"[AUDIO] GCS upload failed, using direct upload ({size_mb:.1f}MB)")

                audio_file = io.BytesIO(audio_bytes)
                audio_file.name = "audio.mp3"
                transcription = await client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3",
                    response_format="verbose_json",
                )

            # Parse verbose_json response
            segments = []
            full_text_parts = []

            if hasattr(transcription, 'segments') and transcription.segments:
                for seg in transcription.segments:
                    # Groq verbose_json returns segments as dictionaries
                    segment = TranscriptSegment(
                        start=seg['start'] + time_offset,
                        end=seg['end'] + time_offset,
                        text=seg['text'].strip(),
                    )
                    segments.append(segment)
                    full_text_parts.append(seg['text'])

                full_text = " ".join(full_text_parts).strip()
            else:
                # Fallback if no segments (shouldn't happen with verbose_json)
                full_text = transcription.text if hasattr(transcription, 'text') else str(transcription)

            logger.info(f"[AUDIO] Transcription complete: {len(full_text)} chars, {len(segments)} segments")

            # Log a preview of the transcription for debugging
            if full_text:
                preview = full_text[:200].replace('\n', ' ')
                logger.info(f"[AUDIO] Transcript preview: {preview}...")

            if segments:
                first_seg = segments[0]
                last_seg = segments[-1]
                logger.info(
                    f"[AUDIO] Timestamps: {first_seg.start:.1f}s - {last_seg.end:.1f}s "
                    f"(duration: {last_seg.end - first_seg.start:.1f}s)"
                )

            return TranscriptResult(text=full_text, segments=segments)

        except Exception as e:
            logger.error(f"[AUDIO] Groq API call failed: {e}", exc_info=True)
            return TranscriptResult(text="", segments=[])

    async def _upload_audio_to_gcs(self, audio_bytes: bytes) -> Optional[str]:
        """
        Upload audio to GCS and return a signed URL for Groq to access.

        Uses Django's default_storage which is already configured with proper
        credentials (via STORAGES settings) and generates signed URLs automatically.

        Files are uploaded to temp/audio-transcription/ path which should have
        a GCS lifecycle rule to auto-delete after 1-7 days.

        Args:
            audio_bytes: Audio file bytes to upload

        Returns:
            Signed URL for the uploaded file, or None if upload fails
        """
        storage_backend = getattr(settings, 'STORAGE_BACKEND', None)
        if storage_backend != 'gcs':
            logger.debug("[AUDIO] GCS not configured, skipping URL-based upload")
            return None

        try:
            from django.core.files.base import ContentFile
            from django.core.files.storage import default_storage

            # Generate unique file path in temp directory
            # GCS lifecycle rules should auto-delete files in temp/ after 1-7 days
            file_id = str(uuid.uuid4())
            file_path = f"temp/audio-transcription/{file_id}.mp3"

            # Upload using Django's default_storage (already configured with GCS credentials)
            def _upload():
                audio_file = ContentFile(audio_bytes)
                return default_storage.save(file_path, audio_file)

            saved_path = await asyncio.to_thread(_upload)

            # Get signed URL (django-storages handles this with querystring_auth=True)
            signed_url = default_storage.url(saved_path)

            size_mb = len(audio_bytes) / (1024 * 1024)
            logger.info(f"[AUDIO] Uploaded {size_mb:.1f}MB to GCS: {saved_path}")

            return signed_url

        except Exception as e:
            logger.warning(f"[AUDIO] GCS upload failed: {e}")
            return None

    def _merge_transcripts(self, transcripts: list[str]) -> str:
        """
        Merge transcripts from multiple chunks, removing duplicate overlap regions.

        Uses fuzzy string matching to find where chunks overlap.
        """
        if len(transcripts) == 0:
            return ""

        if len(transcripts) == 1:
            return transcripts[0]

        merged = transcripts[0]

        for next_transcript in transcripts[1:]:
            # Find overlap region using fuzzy matching
            # Look at the end of merged and start of next
            overlap_chars = min(500, len(merged), len(next_transcript))

            end_of_merged = merged[-overlap_chars:]
            start_of_next = next_transcript[:overlap_chars]

            # Find the best overlap point
            best_overlap = self._find_overlap(end_of_merged, start_of_next)

            if best_overlap:
                # Append non-overlapping portion
                merged += next_transcript[best_overlap:]
            else:
                # No good overlap found, just concatenate with space
                merged += " " + next_transcript

        return merged.strip()

    def _find_overlap(self, end_text: str, start_text: str) -> Optional[int]:
        """
        Find where two text segments overlap.

        Returns the position in start_text where unique content begins.
        """
        # Try different overlap lengths
        for length in range(min(len(end_text), len(start_text)), 20, -10):
            end_portion = end_text[-length:]

            # Use SequenceMatcher to find similar regions
            matcher = SequenceMatcher(None, end_portion, start_text[:length])
            ratio = matcher.ratio()

            if ratio > 0.7:  # 70% similarity threshold
                # Find where the overlap ends in start_text
                blocks = matcher.get_matching_blocks()
                if blocks:
                    # Return position after the match
                    last_block = blocks[-2]  # -1 is always the dummy block
                    return last_block.b + last_block.size

        return None


def format_transcript_markdown(segments: list[TranscriptSegment]) -> str:
    """
    Format transcript segments as markdown with timestamps.

    Args:
        segments: List of TranscriptSegment objects

    Returns:
        Markdown formatted transcript with timestamps
    """
    if not segments:
        return ""

    lines = []
    for segment in segments:
        text = segment.text.strip()

        if not text:
            continue

        # Format timestamp as [MM:SS] or [HH:MM:SS]
        hours = int(segment.start // 3600)
        minutes = int((segment.start % 3600) // 60)
        seconds = int(segment.start % 60)

        if hours > 0:
            timestamp = f"[{hours}:{minutes:02d}:{seconds:02d}]"
        else:
            timestamp = f"[{minutes}:{seconds:02d}]"

        lines.append(f"{timestamp} {text}")

    return "\n".join(lines)

