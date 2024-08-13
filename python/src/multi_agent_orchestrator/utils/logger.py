from typing import List, Optional, Dict, Any
import json
import logging
from multi_agent_orchestrator.types import ConversationMessage, OrchestratorConfig

logging.basicConfig(level=logging.INFO)

class Logger:
    def __init__(self,
                 config: Optional[Dict[str, bool]] = None,
                 logger: Optional[logging.Logger] = logging.getLogger(__name__)):
        self.config: OrchestratorConfig = config or OrchestratorConfig()
        self.set_logger(logger or logging.getLogger(__name__))

    @classmethod
    def set_logger(cls, logger: Any) -> None:
        cls.logger = logger

    @classmethod
    def info(cls, message: str, *args: Any) -> None:
        """Log an info message."""
        cls.logger.info(message, *args)

    @classmethod
    def warn(cls, message: str, *args: Any) -> None:
        """Log a warning message."""
        cls.logger.info(message, *args)

    @classmethod
    def error(cls, message: str, *args: Any) -> None:
        """Log an error message."""
        cls.logger.error(message, *args)

    @classmethod
    def debug(cls, message: str, *args: Any) -> None:
        """Log a debug message."""
        cls.logger.debug(message, *args)

    @classmethod
    def log_header(cls, title: str) -> None:
        """Log a header with the given title."""
        cls.logger.info(f"\n** {title.upper()} **")
        cls.logger.info('=' * (len(title) + 6))

    def print_chat_history(self,
                           chat_history: List[ConversationMessage],
                           agent_id: Optional[str] = None) -> None:
        """Print the chat history for an agent or classifier."""
        is_agent_chat = agent_id is not None
        if (is_agent_chat and not self.config.LOG_AGENT_CHAT) or \
           (not is_agent_chat and not self.config.LOG_CLASSIFIER_CHAT):
            return

        title = f"Agent {agent_id} Chat History" if is_agent_chat else 'Classifier Chat History'
        Logger.log_header(title)

        if not chat_history:
            Logger.logger.info('> - None -')
        else:
            for index, message in enumerate(chat_history, 1):
                role = message.role.upper()
                content = message.content
                text = content[0] if isinstance(content, list) else content
                text = text.get('text', '') if isinstance(text, dict) else str(text)
                trimmed_text = f"{text[:80]}..." if len(text) > 80 else text
                Logger.logger.info(f"> {index}. {role}: {trimmed_text}")
        Logger.logger.info('')

    def log_classifier_output(self, output: Any, is_raw: bool = False) -> None:
        """Log the classifier output."""
        if (is_raw and not self.config.LOG_CLASSIFIER_RAW_OUTPUT) or \
           (not is_raw and not self.config.LOG_CLASSIFIER_OUTPUT):
            return

        Logger.log_header('Raw Classifier Output' if is_raw else 'Processed Classifier Output')
        Logger.logger.info(output if is_raw else json.dumps(output, indent=2))
        Logger.logger.info('')

    def print_execution_times(self, execution_times: Dict[str, float]) -> None:
        """Print execution times."""
        if not self.config.LOG_EXECUTION_TIMES:
            return

        Logger.log_header('Execution Times')
        if not execution_times:
            Logger.logger.info('> - None -')
        else:
            for timer_name, duration in execution_times.items():
                Logger.logger.info(f"> {timer_name}: {duration}ms")
        Logger.logger.info('')
