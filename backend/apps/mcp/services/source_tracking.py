"""
Source tracking for ReAct agent.

Manages citation numbering across multiple tool calls to ensure consistent
source citations in the final answer.

Ported from backend/apps/agents/services/source_tracking.py
"""
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class SourceTracker:
    """
    Tracks sources across multiple ReAct tool calls.
    
    Assigns sequential citation numbers as sources are retrieved,
    handling deduplication to ensure each unique URL gets one number.
    
    Key features:
    - Assigns incremental numbers (1, 2, 3...) as sources are added
    - Deduplicates by URL - same URL always gets same number
    - Never renumbers - citation numbers are stable once assigned
    - Maintains list of all sources with their assigned numbers
    
    Example:
        tracker = SourceTracker()
        
        # First tool call
        num1 = tracker.add_source({'url': 'https://example.com/page1', 'title': 'Page 1'})
        # Returns 1
        
        num2 = tracker.add_source({'url': 'https://example.com/page2', 'title': 'Page 2'})
        # Returns 2
        
        # Second tool call (later in ReAct loop)
        num3 = tracker.add_source({'url': 'https://example.com/page1', 'title': 'Page 1'})
        # Returns 1 (duplicate, uses existing number)
        
        num4 = tracker.add_source({'url': 'https://example.com/page3', 'title': 'Page 3'})
        # Returns 3
        
        sources = tracker.get_sources()
        # Returns 3 sources with citation_number 1, 2, 3
    """
    
    def __init__(self):
        """Initialize empty source tracker."""
        self.sources: List[Dict] = []  # List of sources with assigned numbers
        self.url_to_number: Dict[str, int] = {}  # Dedup map: URL → citation_number
        self.next_number: int = 1  # Next number to assign
    
    def add_source(self, source: dict) -> int:
        """
        Add a source and return its citation number.
        
        If source URL already exists, returns existing number (deduplication).
        Otherwise, assigns new sequential number.
        
        Args:
            source: Dict with at minimum:
                - 'url': Source URL (str, required for dedup)
                - 'title': Source title (str)
                - 'score': Relevance score (float, optional)
                - 'source_type': Type of source (str, e.g., 'article')
        
        Returns:
            Citation number to use for this source (int >= 1)
        
        Example:
            citation_num = tracker.add_source({
                'url': 'https://example.com/pricing',
                'title': 'Pricing Plans',
                'score': 0.89,
                'source_type': 'article'
            })
            # Returns 1 (first source) or existing number if duplicate
        """
        url = source.get('url')
        
        # Check if we've already seen this URL
        if url and url in self.url_to_number:
            existing_number = self.url_to_number[url]
            logger.debug(
                f"[SourceTracker] Duplicate URL detected: {url} → "
                f"using existing [{existing_number}]"
            )
            return existing_number
        
        # New source - assign next number
        citation_number = self.next_number
        self.next_number += 1
        
        # Store source with its number
        source_entry = {
            **source,  # Preserve all original fields
            'citation_number': citation_number,
            'citation_num': citation_number,  # Alias for compatibility
        }
        self.sources.append(source_entry)
        
        # Track URL for deduplication
        if url:
            self.url_to_number[url] = citation_number
        
        logger.debug(
            f"[SourceTracker] New source added: {url} → [{citation_number}] "
            f"(total: {len(self.sources)})"
        )
        
        return citation_number
    
    def get_sources(self) -> List[Dict]:
        """
        Return all tracked sources with their assigned numbers.
        
        Returns:
            List of source dicts, each containing:
                - All original source fields
                - 'citation_number': Assigned citation number (int)
        
        Note: Sources are returned in the order they were added (chronological).
              Citation numbers may not be sequential if deduplication occurred.
        """
        return self.sources
    
    def get_source_by_number(self, citation_number: int) -> Optional[Dict]:
        """
        Get a specific source by its citation number.
        
        Args:
            citation_number: Citation number to look up
        
        Returns:
            Source dict if found, None otherwise
        """
        for source in self.sources:
            if source.get('citation_number') == citation_number:
                return source
        return None
    
    def get_citation_numbers(self) -> List[int]:
        """
        Get list of all assigned citation numbers.
        
        Returns:
            List of citation numbers (may not be sequential)
        
        Example:
            [1, 2, 4]  # Source 3 was retrieved but not kept/cited
        """
        return [s['citation_number'] for s in self.sources]
    
    def __len__(self) -> int:
        """Return number of unique sources tracked."""
        return len(self.sources)
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"<SourceTracker: {len(self.sources)} sources, "
            f"numbers: {self.get_citation_numbers()}>"
        )
