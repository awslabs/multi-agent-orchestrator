import { Button, Header, SpaceBetween } from "@cloudscape-design/components";

export interface ChatHeaderProps {
  onRefreshSession: () => void;
}
export default function ChatHeader(props: ChatHeaderProps) {

  return (
    <Header
      variant="h1"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button iconName="refresh" onClick={() => props.onRefreshSession()} />
        </SpaceBetween>
      }
    >
      Chat
    </Header>
  );
}
