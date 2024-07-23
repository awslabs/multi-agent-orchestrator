import { ButtonProps, Button } from "@cloudscape-design/components";
import { useOnFollow } from "../../common/hooks/use-on-follow";

export default function RouterButton(props: ButtonProps) {
  const onFollow = useOnFollow();

  return <Button {...props} onFollow={onFollow} />;
}
