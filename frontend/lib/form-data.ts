// A text field from a submitted form, trimmed. Missing fields read as "",
// because anyone can POST to a Server Action without the form.
export function formText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}
