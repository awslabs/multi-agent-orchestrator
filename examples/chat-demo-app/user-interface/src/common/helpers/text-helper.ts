export abstract class TextHelper {
  static getTextFilterCounterText(count = 0) {
    return `${count} ${count === 1 ? "match" : "matches"}`;
  }

  static getHeaderCounterText(
    items: ReadonlyArray<unknown>,
    selectedItems: ReadonlyArray<unknown> | undefined,
  ) {
    return selectedItems && selectedItems?.length > 0
      ? `(${selectedItems.length}/${items.length})`
      : `(${items.length})`;
  }
}
