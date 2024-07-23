import {
  Button,
  Popover,
  StatusIndicator,
} from "@cloudscape-design/components";

export function CopyWithPopoverButton(props: {
  readonly text?: string;
  readonly onCopy: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Popover
      size="medium"
      position="top"
      triggerType="custom"
      dismissButton={false}
      content={
        <StatusIndicator type="success">
          {props.text ?? "Copied to clipboard"}
        </StatusIndicator>
      }
    >
      <Button
        disabled={props.disabled}
        variant="icon"
        iconName="copy"
        onClick={props.onCopy}
      />
    </Popover>
  );
}
