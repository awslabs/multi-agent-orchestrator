"""
Code for Classifier.
"""
from .classifier import Classifier, ClassifierResult
from .bedrock_classifier import BedrockClassifier, BedrockClassifierOptions

try:
    from .anthropic_classifier import AnthropicClassifier, AnthropicClassifierOptions
    _ANTHROPIC_AVAILABLE = True
except Exception as e:
    _ANTHROPIC_AVAILABLE = False

try:
    from .openai_classifier import OpenAIClassifier, OpenAIClassifierOptions
    _OPENAI_AVAILABLE = True
except Exception as e:
    _OPENAI_AVAILABLE = False



__all__ = [
    "Classifier",
    "ClassifierResult",
    "BedrockClassifier",
    "BedrockClassifierOptions"
]

if _ANTHROPIC_AVAILABLE:
    __all__.extend([
        "AnthropicClassifier",
        "AnthropicClassifierOptions"
    ])

if _OPENAI_AVAILABLE:
    __all__.extend([
        "OpenAIClassifier",
        "OpenAIClassifierOptions"
    ])