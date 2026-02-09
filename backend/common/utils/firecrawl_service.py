"""
Firecrawl API service for initiating and monitoring website crawls.

This service provides a clean interface to the Firecrawl API using the official SDK for:
- Starting comprehensive website crawls
- Monitoring crawl progress
- Retrieving crawl results
- Single page scraping

Uses the official firecrawl-py SDK for improved reliability and maintainability.

Copyright (C) 2025 Pillar Team

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Note: This file uses the firecrawl-py Python SDK (MIT License) to interact
with the FireCrawl API service. We only make API calls; we do not include
or modify FireCrawl's AGPL-licensed server code.
"""

import logging
from typing import Dict, Any, Optional, List
from django.conf import settings
import os
import requests
from io import BytesIO
from firecrawl import Firecrawl

logger = logging.getLogger(__name__)


class FirecrawlAPIError(Exception):
    """Custom exception for Firecrawl API errors"""
    pass


class FirecrawlService:
    """
    Service class for interacting with the Firecrawl API using the official SDK.
    
    Handles authentication, request formatting, and error handling
    for all Firecrawl operations.
    """
    
    # Mapping of camelCase (API/frontend) to snake_case (Python SDK)
    PARAM_NAME_MAPPING = {
        'includePaths': 'include_paths',
        'excludePaths': 'exclude_paths',
        'maxDiscoveryDepth': 'max_discovery_depth',
        'ignoreQueryParameters': 'ignore_query_parameters',
        'crawlEntireDomain': 'crawl_entire_domain',
        'allowExternalLinks': 'allow_external_links',
        'allowSubdomains': 'allow_subdomains',
        'maxConcurrency': 'max_concurrency',
        'skipTlsVerification': 'skip_tls_verification',
    }
    
    def __init__(self):
        self.api_key = os.getenv('FIRECRAWL_API_KEY')
        
        if self.api_key:
            self.client = Firecrawl(api_key=self.api_key)
        else:
            # Allow initialization without API key for development/testing
            self.client = None
            logger.warning("FIRECRAWL_API_KEY not set - Firecrawl service will not work properly")
    
    def _convert_config_to_snake_case(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert camelCase config keys to snake_case for Python SDK compatibility.
        
        Args:
            config: Dictionary with potentially camelCase keys
            
        Returns:
            Dictionary with snake_case keys
        """
        converted = {}
        for key, value in config.items():
            # Check if this key needs conversion
            if key in self.PARAM_NAME_MAPPING:
                converted[self.PARAM_NAME_MAPPING[key]] = value
            else:
                converted[key] = value
        return converted
    
    def _convert_paths_to_regex(self, paths: List[str]) -> List[str]:
        """
        Convert simple path patterns to regex patterns for Firecrawl.
        
        Users configure simple patterns like '/blog/', '/ja-jp/', 'community/'
        Firecrawl expects regex patterns like '/blog/.*', '/ja-jp/.*', 'community/.*'
        
        If a pattern already looks like regex (contains .*, ^, $, etc.), leave it alone.
        Otherwise, append '.*' to make it match everything under that path.
        
        Args:
            paths: List of simple path patterns
            
        Returns:
            List of regex patterns for Firecrawl
        """
        if not paths:
            return paths
        
        regex_patterns = []
        regex_indicators = ['.*', '.+', '^', '$', '[', ']', '(', ')']
        
        for path in paths:
            # Skip empty patterns
            if not path:
                continue
            
            # If it already looks like regex, keep it as-is
            if any(indicator in path for indicator in regex_indicators):
                regex_patterns.append(path)
                logger.debug(f"Path already regex: {path}")
                continue
            
            # Convert simple path to regex by appending .*
            # Remove trailing slash if present, then add /.*
            path_clean = path.rstrip('/')
            regex_pattern = f"{path_clean}/.*" if path_clean else ".*"
            regex_patterns.append(regex_pattern)
            logger.debug(f"Converted path to regex: {path} -> {regex_pattern}")
        
        return regex_patterns
    
    def start_crawl(self, url: str, crawl_depth: Optional[int] = None, site_crawl=None, source_sync=None, config: Optional[Dict[str, Any]] = None, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Start a comprehensive website crawl using Firecrawl.
        
        Args:
            url: The website URL to crawl
            crawl_depth: Maximum number of pages to crawl (None for unlimited)
            site_crawl: SiteCrawl model instance for webhook configuration (backend)
            source_sync: SourceSync model instance for webhook configuration (hc-backend)
            config: Additional crawl configuration
            language: Preferred language for content extraction
            
        Returns:
            Dict with job ID, status, and URL
        """
        # Verify client is initialized
        if not self.client:
            logger.error("✗ Firecrawl client not initialized - missing API key!")
            raise FirecrawlAPIError("Firecrawl client not initialized. Check FIRECRAWL_API_KEY environment variable.")
        
        logger.info(f"✓ Firecrawl client is initialized and ready")
        
        # Default configuration - minimal restrictions, let users configure via API
        default_scrape_options = {
            "formats": ["markdown", "html"],
            "only_main_content": True,
            "wait_for": 1000,
            "block_ads": True,
            "remove_base64_images": True
        }
        
        # Add language filter if specified
        if language:
            # Convert 'en' to 'en-US' format if needed (Firecrawl requires country code)
            lang_code = language if '-' in language else f"{language}-US"
            default_scrape_options["location"] = {
                "languages": [lang_code]
            }
            logger.info(f"Filtering crawl to language: {lang_code} (original: {language})")
        
        default_crawl_params = {
            "max_discovery_depth": 4,  # Crawl depth: 0=root/sitemap only, 1=+1 level, 2=+2 levels
            "ignore_query_parameters": True,
            "allow_subdomains": False,  # Stay on same subdomain only
        }
        
        # Merge user config with defaults first
        crawl_params = default_crawl_params.copy()
        scrape_options = default_scrape_options.copy()
        
        # Convert simple path patterns to regex for Firecrawl
        # Users configure simple paths like '/blog/', '/ja-jp/'
        # Firecrawl expects regex patterns like '/blog/.*', '/ja-jp/.*'
        if config:
            if 'excludePaths' in config and config['excludePaths']:
                config['excludePaths'] = self._convert_paths_to_regex(config['excludePaths'])
                logger.info(f"Converted excludePaths to regex: {config['excludePaths']}")
            if 'exclude_paths' in config and config['exclude_paths']:
                config['exclude_paths'] = self._convert_paths_to_regex(config['exclude_paths'])
                logger.info(f"Converted exclude_paths to regex: {config['exclude_paths']}")
            if 'includePaths' in config and config['includePaths']:
                config['includePaths'] = self._convert_paths_to_regex(config['includePaths'])
                logger.info(f"Converted includePaths to regex: {config['includePaths']}")
            if 'include_paths' in config and config['include_paths']:
                config['include_paths'] = self._convert_paths_to_regex(config['include_paths'])
                logger.info(f"Converted include_paths to regex: {config['include_paths']}")
        
        # Add webhook configuration if crawl record is provided (site_crawl or source_sync)
        crawl_record = site_crawl or source_sync
        if crawl_record:
            webhook_config = self._get_webhook_config(crawl_record)
            if webhook_config:
                crawl_params['webhook'] = webhook_config
                logger.info(
                    f"✓ Webhook configured for Firecrawl request - "
                    f"URL: {webhook_config.get('url')}, "
                    f"Events: {webhook_config.get('events')}"
                )
                logger.debug(f"Full webhook config: {webhook_config}")
            else:
                logger.info("⊘ No webhook configured for this crawl (containerized check or config missing)")
        
        if config:
            if not isinstance(config, dict):
                logger.error(f"Invalid config type: {type(config)}. Expected dict, got: {config}")
                raise FirecrawlAPIError(f"Config must be a dictionary, got {type(config)}")
            
            try:
                # Convert camelCase to snake_case for Python SDK compatibility
                original_config = config.copy()
                config = self._convert_config_to_snake_case(config)
                if original_config != config:
                    logger.debug(f"Converted config keys: {original_config.keys()} -> {config.keys()}")
                
                # Handle scrape_options separately
                if 'scrape_options' in config:
                    if isinstance(config['scrape_options'], dict):
                        scrape_options.update(config['scrape_options'])
                    else:
                        logger.error(f"Invalid scrape_options type: {type(config['scrape_options'])}")
                        raise FirecrawlAPIError("scrape_options must be a dictionary")
                
                # Also handle legacy scrapeOptions for backward compatibility
                if 'scrapeOptions' in config:
                    if isinstance(config['scrapeOptions'], dict):
                        scrape_options.update(config['scrapeOptions'])
                    else:
                        logger.error(f"Invalid scrapeOptions type: {type(config['scrapeOptions'])}")
                        raise FirecrawlAPIError("scrapeOptions must be a dictionary")
                
                # Only pass parameters that Firecrawl SDK actually accepts (allowlist approach)
                # This is safer than a blocklist - new custom settings won't accidentally break the API
                # Reference: firecrawl.FirecrawlApp.start_crawl() signature
                valid_firecrawl_params = {
                    'prompt',
                    'exclude_paths',
                    'include_paths',
                    'max_discovery_depth',
                    'ignore_sitemap',
                    'ignore_query_parameters',
                    'limit',
                    'crawl_entire_domain',
                    'allow_external_links',
                    'allow_subdomains',
                    'delay',
                    'max_concurrency',
                    'webhook',
                    'zero_data_retention',
                    'integration',
                }
                crawl_config = {k: v for k, v in config.items() if k in valid_firecrawl_params}
                crawl_params.update(crawl_config)
                
                # Ensure max_discovery_depth is never None/null - always enforce default
                # We don't support unlimited crawling via blank/null values
                if crawl_params.get('max_discovery_depth') is None:
                    crawl_params['max_discovery_depth'] = 4
                    logger.info("max_discovery_depth was None/null, enforcing default of 4")
                
            except (TypeError, ValueError) as e:
                logger.error(f"Failed to merge config: {e}. Config: {config}")
                raise FirecrawlAPIError(f"Invalid config format: {e}")
        
        # Final safety check: ensure max_discovery_depth is always set
        # We don't support unlimited crawling - always enforce a default
        if crawl_params.get('max_discovery_depth') is None:
            crawl_params['max_discovery_depth'] = 4
            logger.info("max_discovery_depth was not set, enforcing default of 4")
        
        # Set limit based on crawl_depth parameter or crawl record depth
        # Note: limit is not stored in crawl_config, only used for the API call
        # If crawl_depth is None/null, don't set a limit (unlimited crawling)
        limit_value = None
        
        if crawl_depth is not None:
            limit_value = crawl_depth
        elif site_crawl and hasattr(site_crawl, 'crawl_depth'):
            limit_value = site_crawl.crawl_depth
        # For source_sync, check config for max_pages setting
        elif source_sync and hasattr(source_sync, 'source'):
            source = getattr(source_sync, 'source', None)
            if source:
                crawl_settings = source.connection_config.get('crawl_settings', {})
                limit_value = crawl_settings.get('limit') or crawl_settings.get('max_pages')
        
        # Only set limit if we have a value (None means unlimited)
        if limit_value is not None:
            crawl_params["limit"] = limit_value
            logger.info(f"Crawl limit set to {limit_value} pages")
        else:
            logger.info("No crawl limit set - will crawl entire website")
        
        try:
            logger.info(f"Starting Firecrawl crawl for URL: {url}")
            logger.info(f"Crawl params: {crawl_params}")
            logger.info(f"Scrape options: {scrape_options}")
            
            # Log if webhook is included in the request
            if 'webhook' in crawl_params:
                logger.info(
                    f"→ Sending Firecrawl request WITH webhook enabled to {crawl_params['webhook']['url']}"
                )
            else:
                logger.info("→ Sending Firecrawl request WITHOUT webhook")
            
            result = self.client.start_crawl(
                url=url,
                scrape_options=scrape_options,
                **crawl_params
            )
            
            # Log the raw result for debugging
            logger.info(f"Firecrawl API returned result type: {type(result)}")
            logger.info(f"Firecrawl API result attributes: {dir(result)}")
            logger.info(f"Firecrawl API result as dict (if possible): {result.__dict__ if hasattr(result, '__dict__') else 'N/A'}")
            
            # The result is a CrawlResponse object, not a dict
            job_id = getattr(result, 'id', None) or getattr(result, 'job_id', None)
            
            if job_id:
                logger.info(f"✓ Firecrawl crawl started successfully. Job ID: {job_id}")
            else:
                logger.error(f"✗ Firecrawl API returned result but no job ID found!")
                logger.error(f"Result object: {result}")
                logger.error(f"Result dict (attempt): {result.__dict__ if hasattr(result, '__dict__') else 'Object has no __dict__'}")
            
            # Return a dict for consistency with the rest of the codebase
            return_data = {
                'id': job_id,
                'status': getattr(result, 'status', 'started'),
                'url': url
            }
            logger.debug(f"Returning data to caller: {return_data}")
            return return_data
            
        except Exception as e:
            logger.error(f"Failed to start Firecrawl crawl: {str(e)}", exc_info=True)
            raise FirecrawlAPIError(f"Failed to start crawl: {str(e)}")
    
    def _convert_document_to_dict(self, doc: Any) -> Dict[str, Any]:
        """
        Convert Firecrawl Document object to dict, preserving structure exactly as API provides.
        
        Uses Pydantic's built-in serialization for faithful conversion without data manipulation.
        
        Args:
            doc: Document object or dict from Firecrawl SDK
            
        Returns:
            Plain dictionary representation with structure preserved
        """
        # Already a dict - return as-is
        if isinstance(doc, dict):
            return doc
        
        # Pydantic v2 - preferred
        if hasattr(doc, 'model_dump'):
            return doc.model_dump()
        
        # Pydantic v1 - fallback
        if hasattr(doc, 'dict'):
            return doc.dict()
        
        # Plain object - use __dict__
        if hasattr(doc, '__dict__'):
            return doc.__dict__
        
        # Last resort - return as-is
        return doc
    
    def get_crawl_status(self, job_id: str, next_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Get the status and results of a crawl job.
        
        Args:
            job_id: The Firecrawl job ID returned from start_crawl()
            next_token: Optional pagination token for getting additional results
            
        Returns:
            Dict containing crawl status and any completed pages
            
        Raises:
            FirecrawlAPIError: If the API request fails
        """
        if not self.client:
            raise FirecrawlAPIError("FIRECRAWL_API_KEY environment variable is required")
        
        try:
            # Pass next token if provided for pagination
            if next_token:
                result = self.client.get_crawl_status(job_id, next=next_token)
            else:
                result = self.client.get_crawl_status(job_id)
            
            # Handle CrawlResponse object
            if hasattr(result, 'status'):
                status = result.status
                # Convert Document objects to dicts for JSON serialization
                raw_data = getattr(result, 'data', [])
                data = [self._convert_document_to_dict(doc) for doc in raw_data]
                
                # Convert to dict for consistency
                return {
                    'status': status,
                    'total': getattr(result, 'total', 0),
                    'completed': getattr(result, 'completed', 0),
                    'data': data,
                    'next': getattr(result, 'next', None)
                }
            else:
                # Fallback for dict response
                status = result.get('status', 'unknown')
                logger.debug(f"Firecrawl job {job_id} status: {status}")
                return result
            
        except Exception as e:
            logger.error(f"Failed to get Firecrawl crawl status: {str(e)}")
            raise FirecrawlAPIError(f"Failed to get crawl status: {str(e)}")
    
    def get_all_crawl_data(self, job_id: str) -> Dict[str, Any]:
        """
        Get all crawl data by following pagination until complete.
        
        Args:
            job_id: The Firecrawl job ID returned from start_crawl()
            
        Returns:
            Dict containing complete crawl status and all pages
            
        Raises:
            FirecrawlAPIError: If any API request fails
        """
        if not self.client:
            raise FirecrawlAPIError("FIRECRAWL_API_KEY environment variable is required")
        
        all_data = []
        next_token = None
        status_info = {}
        
        try:
            while True:
                # Get current batch
                result = self.get_crawl_status(job_id, next_token)
                
                # Store status info from first response
                if not status_info:
                    status_info = {
                        'status': result.get('status'),
                        'total': result.get('total', 0),
                        'completed': result.get('completed', 0),
                        'failed': result.get('failed', 0)
                    }
                
                # Add data from this batch
                batch_data = result.get('data', [])
                if batch_data:
                    all_data.extend(batch_data)
                    logger.debug(f"Retrieved {len(batch_data)} pages from Firecrawl job {job_id}")
                
                # Check if there's more data
                next_token = result.get('next')
                if not next_token:
                    break
                    
            logger.info(f"Retrieved total of {len(all_data)} pages from Firecrawl job {job_id}")
            
            # Return combined result
            return {
                **status_info,
                'data': all_data,
                'next': None  # No more pages
            }
            
        except Exception as e:
            logger.error(f"Failed to get all crawl data for job {job_id}: {str(e)}")
            raise FirecrawlAPIError(f"Failed to get all crawl data: {str(e)}")
    
    def cancel_crawl(self, job_id: str) -> Dict[str, Any]:
        """
        Cancel a running crawl job.
        
        Args:
            job_id: The Firecrawl job ID to cancel
            
        Returns:
            Dict containing cancellation confirmation
            
        Raises:
            FirecrawlAPIError: If the API request fails
        """
        if not self.client:
            raise FirecrawlAPIError("FIRECRAWL_API_KEY environment variable is required")
        
        try:
            result = self.client.cancel_crawl(job_id)
            logger.info(f"Firecrawl job {job_id} cancelled successfully")
            
            # Handle response object - convert to dict for consistency
            if hasattr(result, '__dict__'):
                return {
                    'success': getattr(result, 'success', True),
                    'message': getattr(result, 'message', 'Crawl cancelled successfully')
                }
            else:
                return result
            
        except Exception as e:
            logger.error(f"Failed to cancel Firecrawl crawl: {str(e)}")
            raise FirecrawlAPIError(f"Failed to cancel crawl: {str(e)}")
    
    def scrape_page(self, url: str, formats: Optional[List[str]] = None, language: Optional[str] = None, include_screenshot: bool = False) -> Dict[str, Any]:
        """
        Scrape a single page using Firecrawl's scrape endpoint.
        
        Args:
            url: The page URL to scrape
            formats: List of formats to return (e.g., ['markdown', 'html'])
            language: Optional language code to filter content (e.g., 'en', 'es')
            include_screenshot: If True, adds screenshot to formats (returned as URL, expires in 24h)
            
        Returns:
            Dict containing the scraped page data, including screenshot URL if requested
            
        Raises:
            FirecrawlAPIError: If the API request fails
        """
        if not self.client:
            raise FirecrawlAPIError("FIRECRAWL_API_KEY environment variable is required")
        
        # Default to markdown format for LLM analysis
        if formats is None:
            formats = ['markdown']
        
        # Add screenshot format if requested
        # Note: Firecrawl v2 returns screenshot as a URL that expires in 24 hours
        if include_screenshot and 'screenshot' not in formats:
            formats = formats + ['screenshot']
        
        scrape_options = {
            "formats": formats,
            "only_main_content": True,
            "wait_for": 1000,
            "block_ads": True,
            "remove_base64_images": True,
            "exclude_tags": ["nav", "footer", "aside"]
        }
        
        # Add language filter if specified
        if language:
            # Convert 'en' to 'en-US' format if needed (Firecrawl requires country code)
            lang_code = language if '-' in language else f"{language}-US"
            scrape_options["location"] = {
                "languages": [lang_code]
            }
            logger.info(f"Filtering scrape to language: {lang_code} (original: {language})")
        
        try:
            logger.info(f"Scraping page with Firecrawl: {url} (formats: {formats})")
            logger.debug(f"Scrape options: {scrape_options}")
            result = self.client.scrape(url, **scrape_options)
            logger.info(f"Successfully scraped page: {url}")
            
            # Handle response object - convert to dict for consistency
            if hasattr(result, '__dict__'):
                # If result has data attribute and it's a Document, convert it
                data = getattr(result, 'data', {})
                if hasattr(data, '__dict__') and not isinstance(data, dict):
                    data = self._convert_document_to_dict(data)
                
                # Get metadata and convert if it's a Pydantic object
                metadata = getattr(result, 'metadata', {}) or getattr(data, 'metadata', {})
                if hasattr(metadata, '__dict__') and not isinstance(metadata, dict):
                    # Convert Pydantic DocumentMetadata to dict
                    metadata = vars(metadata) if hasattr(metadata, '__dict__') else {}
                
                # Get screenshot URL if included (Firecrawl v2 returns URL that expires in 24h)
                screenshot_url = getattr(result, 'screenshot', None) or getattr(data, 'screenshot', None)
                if screenshot_url:
                    logger.info(f"Screenshot URL received for {url}: {screenshot_url}")
                
                return {
                    'success': getattr(result, 'success', True),
                    'data': data,
                    'markdown': getattr(result, 'markdown', '') or getattr(data, 'markdown', ''),
                    'html': getattr(result, 'html', '') or getattr(data, 'html', ''),
                    'screenshot': screenshot_url,
                    'metadata': metadata
                }
            else:
                return result
            
        except Exception as e:
            logger.error(f"Failed to scrape page with Firecrawl: {str(e)}")
            raise FirecrawlAPIError(f"Failed to scrape page: {str(e)}")

    def map_site(self, url: str, limit: int = 5000, search: Optional[str] = None) -> Dict[str, Any]:
        """
        Map a website to discover all URLs without scraping content.
        
        Much faster and cheaper than crawling - use for discovery.
        See: https://docs.firecrawl.dev/features/map
        
        Args:
            url: The website URL to map
            limit: Maximum URLs to return (default 5000)
            search: Optional search query to filter relevant URLs
            
        Returns:
            Dict with 'success' bool and 'links' array containing discovered URLs
            Each link is a dict with 'url', 'title', and optional 'description'
            
        Raises:
            FirecrawlAPIError: If the API call fails
        """
        if not self.client:
            raise FirecrawlAPIError("Firecrawl client not initialized. Check FIRECRAWL_API_KEY environment variable.")
        
        try:
            logger.info(f"Mapping site: {url} (limit={limit})")
            
            params = {"limit": limit}
            if search:
                params["search"] = search
            
            result = self.client.map(url, **params)
            
            # Convert response to consistent format
            if hasattr(result, 'links'):
                raw_links = result.links
            elif isinstance(result, dict):
                raw_links = result.get('links', [])
            else:
                raw_links = []
            
            links = []
            for link in raw_links:
                if hasattr(link, 'url'):
                    links.append({
                        'url': link.url,
                        'title': getattr(link, 'title', None),
                        'description': getattr(link, 'description', None),
                    })
                elif isinstance(link, dict):
                    links.append({
                        'url': link.get('url', ''),
                        'title': link.get('title'),
                        'description': link.get('description'),
                    })
                elif isinstance(link, str):
                    links.append({'url': link, 'title': None, 'description': None})
            
            logger.info(f"Map complete: {len(links)} URLs discovered")
            
            return {
                'success': True,
                'links': links
            }
            
        except Exception as e:
            logger.error(f"Failed to map site: {str(e)}", exc_info=True)
            raise FirecrawlAPIError(f"Failed to map site: {str(e)}")

    def get_default_config(self) -> Dict[str, Any]:
        """
        Get default Firecrawl configuration with minimal restrictions.
        Users can override via the config parameter in start_crawl().
        
        Returns:
            Dict containing basic Firecrawl configuration with separate crawl params and scrape options
        """
        return {
            "max_discovery_depth": 4,
            "ignore_query_parameters": True,
            "allow_subdomains": False,  # Stay on same subdomain only
            "scrape_options": {
                "formats": ["markdown", "html"],
                "only_main_content": True,
                "wait_for": 1000,
                "block_ads": True,
                "remove_base64_images": True,
                "exclude_tags": ["nav", "footer", "aside"]
            }
        }
    
    def _get_webhook_config(self, crawl_record, source=None) -> Optional[Dict[str, Any]]:
        """
        Generate webhook configuration for a crawl record.
        
        Supports both:
        - SiteCrawl (backend) - for main product crawling
        - SourceSync (hc-backend) - for help center source crawling
        
        Note: The webhook secret is NOT sent to Firecrawl. Instead, it must be configured
        in the Firecrawl dashboard. Firecrawl uses their copy of the secret to sign webhooks
        with HMAC-SHA256, sending the signature in the X-Firecrawl-Signature header.
        Our endpoint verifies this signature using our local FIRECRAWL_WEBHOOK_SECRET.
        
        Args:
            crawl_record: SiteCrawl or SourceSync instance to generate webhook config for
            source: Optional HelpCenterSource (for SourceSync records)
            
        Returns:
            Dict containing webhook configuration or None if not configured or not containerized
        """
        from django.conf import settings
        import os
        
        crawl_id = str(crawl_record.id)
        logger.debug(f"Generating webhook config for crawl {crawl_id}")
        
        # Check if we're in a containerized environment
        is_containerized = os.getenv('IS_CONTAINERIZED', 'false').lower() == 'true'
        
        if not is_containerized:
            logger.info(
                f"⊘ Webhook disabled for crawl {crawl_id}: "
                "Non-containerized environment (IS_CONTAINERIZED != true)"
            )
            return None
        
        # Generate webhook URL from current site or request
        webhook_url = self._get_webhook_url()
        if not webhook_url:
            logger.warning(
                f"⊘ Webhook disabled for crawl {crawl_id}: "
                "Could not determine webhook URL"
            )
            return None
        
        # Build metadata based on crawl record type
        metadata = {"crawl_uuid": crawl_id}
        
        # Check record type to set appropriate metadata
        # KnowledgeSource (hc-backend direct) - has source_type and url, but not source_id
        if hasattr(crawl_record, 'source_type') and hasattr(crawl_record, 'url'):
            # KnowledgeSource passed directly from hc-backend crawl_async
            # The crawl_uuid is already the source ID
            metadata["source_uuid"] = crawl_id
            metadata["crawl_type"] = "knowledge_source"
        elif hasattr(crawl_record, 'source_id'):
            # SourceSync from hc-backend (legacy)
            source_id = str(crawl_record.source_id) if crawl_record.source_id else None
            if source_id:
                metadata["source_uuid"] = source_id
                metadata["crawl_type"] = "help_center_source"
        elif hasattr(crawl_record, 'site_id'):
            # SiteCrawl from backend
            metadata["site_uuid"] = str(crawl_record.site.id) if hasattr(crawl_record, 'site') else str(crawl_record.site_id)
            metadata["crawl_type"] = "site"
        
        webhook_config = {
            "url": webhook_url,
            "metadata": metadata,
            "events": ["started", "page", "completed", "failed"]
        }
        
        logger.info(
            f"✓ Webhook config generated for crawl {crawl_id} - "
            f"URL: {webhook_url}, Events: {webhook_config['events']}, "
            f"Type: {metadata.get('crawl_type', 'unknown')}"
        )
        
        return webhook_config
    
    def _get_webhook_url(self) -> Optional[str]:
        """
        Generate the full webhook URL by detecting the backend URL.
        
        Tries multiple methods to determine the backend URL:
        1. NEXT_PUBLIC_API_URL env var (backend API URL - primary source)
        2. Django Sites framework
        3. ALLOWED_HOSTS
        
        Returns:
            Full webhook URL or None if cannot be determined
        """
        from django.conf import settings
        import os
        
        base_url = None
        
        # Method 1: Use NEXT_PUBLIC_API_URL (backend API URL used by frontend)
        next_public_api_url = os.getenv('NEXT_PUBLIC_API_URL')
        if next_public_api_url:
            base_url = next_public_api_url
            logger.debug(f"Webhook URL base determined from NEXT_PUBLIC_API_URL: {base_url}")
        else:
            logger.debug("NEXT_PUBLIC_API_URL not set, webhook URL cannot be determined")
        
        if not base_url:
            return None
        
        # Clean up and append webhook path
        base_url = base_url.rstrip('/')
        webhook_url = f"{base_url}/api/v1/webhooks/firecrawl/"
        logger.debug(f"Generated full webhook URL: {webhook_url}")
        return webhook_url


def download_and_store_screenshot(screenshot_url: str, site_id: str, page_id: str) -> Optional[str]:
    """
    Download a screenshot from Firecrawl's temporary URL and store it in object storage.
    
    Firecrawl v2 returns screenshot URLs that expire after 24 hours. This function
    downloads the screenshot and stores it permanently in our object storage.
    
    Validates image dimensions to ensure it's a real screenshot (minimum 100x100 pixels).
    
    Args:
        screenshot_url: Temporary Firecrawl screenshot URL (expires in 24h)
        site_id: Site UUID for organizing storage path
        page_id: Page UUID for unique filename
        
    Returns:
        Storage path of saved screenshot, or None if download/save/validation failed
        
    Raises:
        Exception: If download or storage operation fails
    """
    from django.core.files.storage import default_storage
    from django.core.files.base import ContentFile
    from PIL import Image
    from io import BytesIO
    
    if not screenshot_url:
        logger.warning("No screenshot URL provided")
        return None
    
    try:
        # Download screenshot from Firecrawl's temporary URL
        logger.info(f"Downloading screenshot from: {screenshot_url}")
        response = requests.get(screenshot_url, timeout=30)
        response.raise_for_status()
        
        # Validate content size
        content_length = len(response.content)
        if content_length == 0:
            logger.error("Downloaded screenshot is empty (0 bytes)")
            return None
        
        if content_length < 1024:  # Less than 1KB is suspicious
            logger.warning(f"Downloaded screenshot is very small ({content_length} bytes), might be invalid")
        
        # Validate image dimensions using PIL
        try:
            image = Image.open(BytesIO(response.content))
            width, height = image.size
            
            # Minimum reasonable screenshot dimensions
            MIN_WIDTH = 100
            MIN_HEIGHT = 100
            
            if width < MIN_WIDTH or height < MIN_HEIGHT:
                logger.error(
                    f"Screenshot dimensions too small: {width}x{height} "
                    f"(minimum: {MIN_WIDTH}x{MIN_HEIGHT})"
                )
                return None
            
            logger.info(f"Screenshot validated: {width}x{height} pixels, {content_length} bytes")
            
        except Exception as e:
            logger.error(f"Failed to validate screenshot image: {str(e)}")
            return None
        
        # Determine content type and file extension
        content_type = response.headers.get('content-type', 'image/png')
        if 'jpeg' in content_type or 'jpg' in content_type:
            extension = 'jpg'
        elif 'png' in content_type:
            extension = 'png'
        elif 'webp' in content_type:
            extension = 'webp'
        else:
            # Default to PNG
            extension = 'png'
            logger.warning(f"Unknown content type {content_type}, defaulting to PNG")
        
        # Generate storage path
        # Format: screenshots/site_{site_id}/page_{page_id}.{ext}
        file_path = f"screenshots/site_{site_id}/page_{page_id}.{extension}"
        
        # Save to storage
        logger.info(f"Saving screenshot to storage: {file_path}")
        saved_path = default_storage.save(file_path, ContentFile(response.content))
        
        # CRITICAL: Verify file exists in GCS before returning path
        # This prevents orphaned database references to non-existent files
        try:
            if not default_storage.exists(saved_path):
                logger.error(f"File verification failed: {saved_path} does not exist in storage after save")
                return None
            
            logger.info(f"✓ Screenshot saved and verified in storage: {saved_path}")
        except Exception as verify_error:
            logger.error(f"Failed to verify screenshot existence: {str(verify_error)}")
            return None
        
        return saved_path
        
    except requests.RequestException as e:
        logger.error(f"Failed to download screenshot from {screenshot_url}: {str(e)}")
        return None  # Return None instead of raising to prevent workflow failure
    except Exception as e:
        logger.error(f"Failed to save screenshot to storage: {str(e)}")
        return None  # Return None instead of raising to prevent workflow failure


# Singleton instance for easy importing
firecrawl_service = FirecrawlService()

