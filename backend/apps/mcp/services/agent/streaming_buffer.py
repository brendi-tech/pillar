"""
Streaming sources buffer for detecting and extracting SOURCES_USED footer.

Buffers streaming tokens to detect the footer pattern and prevents it
from being displayed to users while extracting source citation numbers.
"""
import logging
import re
from typing import List

logger = logging.getLogger(__name__)


class StreamingSourcesBuffer:
    """
    Buffers streaming tokens to detect and extract SOURCES_USED footer.
    
    Streams tokens directly without modification, but detects the footer
    pattern and prevents it from being displayed to users.
    
    The LLM is instructed to end its response with:
        SOURCES_USED: 1, 3, 5
    
    This class detects that pattern, extracts the source numbers,
    and ensures the footer doesn't appear in the streamed output.
    """
    
    # The footer marker we're looking for
    FOOTER_MARKER = "SOURCES_USED:"
    
    def __init__(self):
        self.buffer = ""
        self.footer_detected = False
        self.sources_used: List[int] = []
        self.full_text = ""  # Keep track of complete text for analytics
    
    def process_token(self, token: str) -> str:
        """
        Process token and return text to stream.
        
        Streams tokens directly, but buffers when we might be entering
        the footer section. Once footer is detected, stops streaming
        and parses source numbers.
        
        Args:
            token: Token from LLM stream
        
        Returns:
            Text to stream (empty string if footer detected or buffering)
        """
        self.full_text += token
        
        # If footer already detected, don't stream anything more
        if self.footer_detected:
            self.buffer += token
            return ""
        
        # Add token to buffer for footer detection
        self.buffer += token
        
        # Check if buffer contains the footer marker
        if self.FOOTER_MARKER in self.buffer:
            self.footer_detected = True
            # Extract text before the footer marker
            marker_pos = self.buffer.find(self.FOOTER_MARKER)
            
            # Find the start of the footer line (look for newlines before marker)
            line_start = self.buffer.rfind('\n', 0, marker_pos)
            if line_start == -1:
                line_start = 0
            else:
                line_start += 1  # Move past the newline
            
            # Check if everything from line_start to marker is whitespace
            prefix = self.buffer[line_start:marker_pos]
            if prefix.strip() == '':
                # Footer is on its own line, strip from line start
                text_to_stream = self.buffer[:line_start].rstrip('\n')
            else:
                # Footer is inline (shouldn't happen but handle gracefully)
                text_to_stream = self.buffer[:marker_pos].rstrip()
            
            # Keep footer portion for parsing later
            self.buffer = self.buffer[marker_pos:]
            return text_to_stream
        
        # Check if buffer might be building up to the footer marker
        for i in range(1, len(self.FOOTER_MARKER)):
            if self.buffer.endswith(self.FOOTER_MARKER[:i]):
                # Potential partial match - buffer the uncertain portion
                safe_to_stream = self.buffer[:-i]
                self.buffer = self.buffer[-i:]
                return safe_to_stream
        
        # Check for newlines that might precede the footer
        if self.buffer.endswith('\n\n') or self.buffer.endswith('\n'):
            stripped = self.buffer.rstrip('\n')
            if stripped:
                newline_start = len(stripped)
                to_stream = self.buffer[:newline_start]
                self.buffer = self.buffer[newline_start:]
                return to_stream
            return ""
        
        # No potential footer, stream everything
        to_stream = self.buffer
        self.buffer = ""
        return to_stream
    
    def flush(self) -> str:
        """
        Flush remaining buffer at end of stream.
        
        Parses source numbers if footer was detected.
        Returns any remaining non-footer text.
        """
        if self.footer_detected:
            self._parse_sources_from_buffer()
            return ""
        
        remaining = self.buffer
        self.buffer = ""
        return remaining
    
    def _parse_sources_from_buffer(self) -> None:
        """Parse source numbers from the footer in the buffer."""
        if 'none' in self.buffer.lower():
            self.sources_used = []
            return
        
        # Extract numbers after the marker
        numbers_part = self.buffer.replace(self.FOOTER_MARKER, '').strip()
        
        # Parse comma-separated numbers
        numbers = []
        for part in numbers_part.split(','):
            part = part.strip()
            match = re.match(r'^(\d+)', part)
            if match:
                numbers.append(int(match.group(1)))
        
        self.sources_used = numbers
        logger.debug(f"[SourcesBuffer] Parsed sources from footer: {self.sources_used}")
    
    def get_sources_used(self) -> List[int]:
        """Return parsed source numbers from footer."""
        return self.sources_used
    
    def get_clean_answer(self) -> str:
        """
        Return the answer text without the SOURCES_USED footer.
        """
        if not self.footer_detected:
            return self.full_text
        
        if self.FOOTER_MARKER in self.full_text:
            marker_pos = self.full_text.find(self.FOOTER_MARKER)
            line_start = self.full_text.rfind('\n', 0, marker_pos)
            if line_start == -1:
                line_start = 0
            else:
                line_start += 1
            
            prefix = self.full_text[line_start:marker_pos]
            if prefix.strip() == '':
                return self.full_text[:line_start].rstrip('\n')
            else:
                return self.full_text[:marker_pos].rstrip()
        
        return self.full_text
    
    def get_full_text(self) -> str:
        """Return complete text received (for analytics)."""
        return self.full_text
