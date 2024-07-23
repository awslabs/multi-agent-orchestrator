import { Link, LinkProps } from "@cloudscape-design/components";
import { useOnFollow } from "../../common/hooks/use-on-follow";

export default function RouterLink(props: LinkProps) {
  const onFollow = useOnFollow();

  return <Link {...props} onFollow={onFollow} />;
}
