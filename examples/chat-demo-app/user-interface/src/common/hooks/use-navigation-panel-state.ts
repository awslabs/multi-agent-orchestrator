import { useState } from "react";
import { StorageHelper } from "../helpers/storage-helper";
import { NavigationPanelState } from "../types";

export function useNavigationPanelState(): [
  NavigationPanelState,
  (state: Partial<NavigationPanelState>) => void,
] {
  const [currentState, setCurrentState] = useState(
    StorageHelper.getNavigationPanelState(),
  );

  const onChange = (state: Partial<NavigationPanelState>) => {
    setCurrentState(StorageHelper.setNavigationPanelState(state));
  };

  return [currentState, onChange];
}
