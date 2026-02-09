"""
Tests for AudioTranscriptionService.
"""
import pytest

from common.services.audio_transcription import (
    AudioTranscriptionService,
    TranscriptResult,
    TranscriptSegment,
    format_transcript_markdown,
)


class TestTranscriptResult:
    """Tests for TranscriptResult dataclass."""

    def test_from_text(self):
        """Test creating result from plain text."""
        result = TranscriptResult.from_text("Hello world")
        assert result.text == "Hello world"
        assert result.segments == []

    def test_str_conversion(self):
        """Test string conversion."""
        result = TranscriptResult(text="Hello", segments=[])
        assert str(result) == "Hello"

    def test_bool_with_text(self):
        """Test boolean conversion with text."""
        result = TranscriptResult(text="Hello", segments=[])
        assert bool(result) is True

    def test_bool_empty(self):
        """Test boolean conversion without text."""
        result = TranscriptResult(text="", segments=[])
        assert bool(result) is False

    def test_to_dict(self):
        """Test dict conversion."""
        segment = TranscriptSegment(start=0.0, end=5.0, text="Hello")
        result = TranscriptResult(text="Hello", segments=[segment])
        
        data = result.to_dict()
        
        assert data["text"] == "Hello"
        assert len(data["segments"]) == 1
        assert data["segments"][0]["start"] == 0.0
        assert data["segments"][0]["end"] == 5.0
        assert data["segments"][0]["text"] == "Hello"


class TestTranscriptSegment:
    """Tests for TranscriptSegment dataclass."""

    def test_creation(self):
        """Test segment creation."""
        segment = TranscriptSegment(start=10.5, end=15.0, text="Test text")
        assert segment.start == 10.5
        assert segment.end == 15.0
        assert segment.text == "Test text"


class TestFormatTranscriptMarkdown:
    """Tests for format_transcript_markdown function."""

    def test_empty_segments(self):
        """Test formatting empty segments list."""
        assert format_transcript_markdown([]) == ""

    def test_single_segment(self):
        """Test formatting single segment."""
        segments = [TranscriptSegment(start=0.0, end=5.0, text="Hello")]
        result = format_transcript_markdown(segments)
        assert "[0:00] Hello" in result

    def test_multiple_segments(self):
        """Test formatting multiple segments."""
        segments = [
            TranscriptSegment(start=0.0, end=5.0, text="First"),
            TranscriptSegment(start=65.0, end=70.0, text="Second"),
        ]
        result = format_transcript_markdown(segments)
        
        assert "[0:00] First" in result
        assert "[1:05] Second" in result

    def test_hours_format(self):
        """Test hour formatting in timestamps."""
        segments = [
            TranscriptSegment(start=3661.0, end=3665.0, text="Hour mark"),
        ]
        result = format_transcript_markdown(segments)
        assert "[1:01:01]" in result

    def test_skips_empty_text(self):
        """Test that empty text segments are skipped."""
        segments = [
            TranscriptSegment(start=0.0, end=5.0, text="Content"),
            TranscriptSegment(start=5.0, end=10.0, text="  "),  # Empty
            TranscriptSegment(start=10.0, end=15.0, text="More"),
        ]
        result = format_transcript_markdown(segments)
        lines = [l for l in result.split("\n") if l.strip()]
        assert len(lines) == 2


class TestAudioTranscriptionService:
    """Tests for AudioTranscriptionService."""

    def test_init(self):
        """Test service initialization."""
        service = AudioTranscriptionService()
        assert service.MAX_FILE_SIZE_MB == 100
        assert service.TARGET_SIZE_MB == 95.0

    def test_select_bitrate_small_file(self):
        """Test bitrate selection for files just over limit."""
        service = AudioTranscriptionService()
        # 100MB file needs ~5% reduction
        bitrate = service._select_bitrate(105.0)
        assert bitrate == "128k"  # High quality

    def test_select_bitrate_large_file(self):
        """Test bitrate selection for large files."""
        service = AudioTranscriptionService()
        # 300MB file needs ~68% reduction
        bitrate = service._select_bitrate(300.0)
        assert bitrate == "32k"  # Maximum compression

    def test_select_bitrate_medium_file(self):
        """Test bitrate selection for medium files."""
        service = AudioTranscriptionService()
        # 150MB file needs ~37% reduction (ratio 0.63)
        bitrate = service._select_bitrate(150.0)
        # Ratio 0.63 falls in (0.60, 0.80) range -> 96k
        assert bitrate == "96k"  # Medium-high quality

    @pytest.mark.asyncio
    async def test_transcribe_audio_bytes_empty(self):
        """Test transcription of empty bytes returns empty result."""
        service = AudioTranscriptionService()
        result = await service.transcribe_audio_bytes(b"")
        
        assert result.text == ""
        assert result.segments == []

    def test_merge_transcripts_empty(self):
        """Test merging empty transcript list."""
        service = AudioTranscriptionService()
        result = service._merge_transcripts([])
        assert result == ""

    def test_merge_transcripts_single(self):
        """Test merging single transcript."""
        service = AudioTranscriptionService()
        result = service._merge_transcripts(["Hello world"])
        assert result == "Hello world"

    def test_merge_transcripts_multiple(self):
        """Test merging multiple transcripts."""
        service = AudioTranscriptionService()
        transcripts = ["First part.", "Second part.", "Third part."]
        result = service._merge_transcripts(transcripts)
        
        # Should contain all parts
        assert "First part" in result
        assert "Second part" in result
        assert "Third part" in result

