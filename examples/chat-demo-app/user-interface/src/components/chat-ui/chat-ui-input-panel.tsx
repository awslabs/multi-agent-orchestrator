import {
  Button,
  Container,
  SpaceBetween,
  Spinner,
} from "@cloudscape-design/components";
import { useEffect, useLayoutEffect, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatScrollState } from "./chat-ui";
import { ChatMessage } from "./types";
import styles from "../../styles/chat-ui.module.scss";

export interface ChatUIInputPanelProps {
  inputPlaceholderText?: string;
  sendButtonText?: string;
  running?: boolean;
  messages?: ChatMessage[];
  onSendMessage?: (message: string) => void;
}

export default function ChatUIInputPanel(props: ChatUIInputPanelProps) {
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }

      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
            window.scrollY -
            document.documentElement.scrollHeight
        ) <= 10;

      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };

    window.addEventListener("scroll", onWindowScroll);

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }

    if (!ChatScrollState.userHasScrolled && (props.messages ?? []).length > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messages]);

  const onSendMessage = () => {
    ChatScrollState.userHasScrolled = false;
    props.onSendMessage?.(inputText);
    setInputText("");
  };

  const onTextareaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (!props.running && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSendMessage();
    }
  };

  return (
    <SpaceBetween direction="vertical" size="l">
      <Container>
        <div className={styles.input_textarea_container}>
          <TextareaAutosize
            className={styles.input_textarea}
            maxRows={6}
            minRows={1}
            spellCheck={true}
            autoFocus
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            value={inputText}
            placeholder={props.inputPlaceholderText ?? "Send a message"}
          />
          <div style={{ marginLeft: "8px" }}>
            <Button
              disabled={props.running || inputText.trim().length === 0}
              onClick={onSendMessage}
              iconAlign="right"
              iconName={!props.running ? "angle-right-double" : undefined}
              variant="primary"
            >
              {props.running ? (
                <>
                  Loading&nbsp;&nbsp;
                  <Spinner />
                </>
              ) : (
                <>{props.sendButtonText ?? "Send"}</>
              )}
            </Button>
          </div>
        </div>
      </Container>
    </SpaceBetween>
  );
}
