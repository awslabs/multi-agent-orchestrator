import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { ChatMessage, ChatMessageType } from "./types";
import styles from "../../styles/chat-ui.module.scss";
import { BaseChatMessage } from "./BaseChatMessage";

export interface ChatUIMessageProps {
  readonly message: ChatMessage;
}

export default function ChatUIMessage(props: ChatUIMessageProps) {
  return (
    <BaseChatMessage
      role={props.message?.type === ChatMessageType.AI ? "ai" : "human"}
      onCopy={() => {
        navigator.clipboard.writeText(props.message.message);
      }}
      waiting={props.message.message.length === 0}
      name={props.message?.type === ChatMessageType.AI ? "Bot" : "User"}
    >
      <ReactMarkdown
        className={styles.markdown}
        remarkPlugins={[remarkGfm]}
        components={{
          pre(props) {
            const { children, ...rest } = props;
            return (
              <pre {...rest} className={styles.codeMarkdown}>
                {children}
              </pre>
            );
          },
          table(props) {
            const { children, ...rest } = props;
            return (
              <table {...rest} className={styles.markdownTable}>
                {children}
              </table>
            );
          },
          th(props) {
            const { children, ...rest } = props;
            return (
              <th {...rest} className={styles.markdownTableCell}>
                {children}
              </th>
            );
          },
          td(props) {
            const { children, ...rest } = props;
            return (
              <td {...rest} className={styles.markdownTableCell}>
                {children}
              </td>
            );
          },
        }}
      >
        {props.message.message.trim()}
      </ReactMarkdown>
    </BaseChatMessage>
  );
}
