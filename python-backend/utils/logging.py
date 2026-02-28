"""
Centralized logging configuration for the In-Flo backend.
Provides pre-configured loggers for each module with consistent formatting.
"""
import sys
import logging
from typing import Optional

from config import LOG_LEVEL

# Default format for all loggers
LOG_FORMAT = "%(asctime)s | %(name)-20s | %(levelname)-7s | %(message)s"
DATE_FORMAT = "%H:%M:%S"

# Map string level to logging constant
_LEVEL_MAP = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
}
_DEFAULT_LEVEL = _LEVEL_MAP.get(LOG_LEVEL.upper(), logging.INFO)

# Cache for loggers
_loggers: dict[str, logging.Logger] = {}


def get_logger(name: str, level: Optional[int] = None) -> logging.Logger:
    """
    Get or create a configured logger.
    
    Args:
        name: Logger name (usually module name like 'SEARCH', 'VECTOR_STORE')
        level: Optional log level override (defaults to LOG_LEVEL from config)
        
    Returns:
        Configured logger instance
    """
    if name in _loggers:
        return _loggers[name]
    
    logger = logging.getLogger(name)
    logger.setLevel(level or _DEFAULT_LEVEL)
    
    # Only add handler if none exist (avoid duplicate handlers)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
        logger.addHandler(handler)
        logger.propagate = False
    
    _loggers[name] = logger
    return logger


# Pre-configured loggers for each module
def server_logger() -> logging.Logger:
    """Logger for server startup/shutdown."""
    return get_logger("SERVER")


def chat_logger() -> logging.Logger:
    """Logger for chat route."""
    return get_logger("CHAT")


def search_logger() -> logging.Logger:
    """Logger for web search."""
    return get_logger("SEARCH")


def scraper_logger() -> logging.Logger:
    """Logger for web scraper."""
    return get_logger("SCRAPER")


def vector_store_logger() -> logging.Logger:
    """Logger for vector store operations."""
    return get_logger("VECTOR_STORE")


def query_expander_logger() -> logging.Logger:
    """Logger for query expansion."""
    return get_logger("QUERY_EXPANDER")


def context_builder_logger() -> logging.Logger:
    """Logger for context builder."""
    return get_logger("CONTEXT_BUILDER")


def sources_logger() -> logging.Logger:
    """Logger for source processing."""
    return get_logger("SOURCES")
