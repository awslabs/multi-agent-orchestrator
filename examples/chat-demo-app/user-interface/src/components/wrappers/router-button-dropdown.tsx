import {
  ButtonDropdownProps,
  ButtonDropdown,
} from "@cloudscape-design/components";
import { useOnFollow } from "../../common/hooks/use-on-follow";

export default function RouterButtonDropdown(props: ButtonDropdownProps) {
  const onFollow = useOnFollow();

  return <ButtonDropdown {...props} onItemFollow={onFollow} />;
}
