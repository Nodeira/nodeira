/**
 * Opens the OS file picker for an image and resolves with the chosen file.
 *
 * Resolves with `null` if nothing is chosen — note that a cancelled picker fires no event at
 * all in most browsers, so that promise simply never settles and the detached input is
 * collected. Callers must therefore treat this as "runs the continuation on success", not as
 * something to await in sequence.
 */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
