import { fieldClass } from "@/components/ui";

export function PositionSelect({
  name = "position",
  positions,
  defaultValue = "",
  required = false,
  form,
  allowBlank = false,
}: {
  name?: string;
  positions: string[];
  defaultValue?: string;
  required?: boolean;
  form?: string;
  allowBlank?: boolean;
}) {
  const options = [...new Set([defaultValue, ...positions].map((item) => item.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
  return (
    <select className={fieldClass} name={name} form={form} defaultValue={defaultValue} required={required}>
      {allowBlank || !required || !defaultValue ? <option value="">{required ? "Choose a position" : "All"}</option> : null}
      {options.map((position) => (
        <option key={position} value={position}>
          {position}
        </option>
      ))}
    </select>
  );
}
