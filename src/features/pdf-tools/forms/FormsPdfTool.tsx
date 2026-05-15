import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
} from "pdf-lib";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";

interface FormFieldData {
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown";
  value?: string | boolean;
  options?: string[];
}

export function FormsPdfTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  const [formFields, setFormFields] = useState<FormFieldData[]>([]);
  const [formValues, setFormValues] = useState<
    Record<string, string | boolean>
  >({});
  const [flatten, setFlatten] = useState(true);

  async function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el archivo.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
    setFormFields([]);
    setFormValues({});

    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const form = doc.getForm();
      const fields = form.getFields();

      const parsedFields: FormFieldData[] = [];
      const initialValues: Record<string, string | boolean> = {};

      for (const field of fields) {
        const name = field.getName();
        if (field instanceof PDFTextField) {
          parsedFields.push({ name, type: "text" });
          initialValues[name] = field.getText() || "";
        } else if (field instanceof PDFCheckBox) {
          parsedFields.push({ name, type: "checkbox" });
          initialValues[name] = field.isChecked();
        } else if (field instanceof PDFRadioGroup) {
          parsedFields.push({
            name,
            type: "radio",
            options: field.getOptions(),
          });
          initialValues[name] = field.getSelected() || "";
        } else if (field instanceof PDFDropdown) {
          parsedFields.push({
            name,
            type: "dropdown",
            options: field.getOptions(),
          });
          initialValues[name] = field.getSelected()[0] || "";
        }
      }
      setFormFields(parsedFields);
      setFormValues(initialValues);

      if (parsedFields.length === 0) {
        setErrorMessage(
          "Este PDF no contiene campos de formulario rellenables.",
        );
      }
    } catch {
      setErrorMessage("No se pudo leer el formulario del PDF.");
    }
  }

  async function handleFillAndSave() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const form = doc.getForm();

      for (const [name, value] of Object.entries(formValues)) {
        const field = form.getField(name);
        if (!field) continue;

        if (field instanceof PDFTextField && typeof value === "string") {
          field.setText(value);
        } else if (field instanceof PDFCheckBox && typeof value === "boolean") {
          if (value) {
            field.check();
          } else {
            field.uncheck();
          }
        } else if (
          field instanceof PDFRadioGroup &&
          typeof value === "string" &&
          value
        ) {
          field.select(value);
        } else if (
          field instanceof PDFDropdown &&
          typeof value === "string" &&
          value
        ) {
          field.select(value);
        }
      }

      if (flatten) {
        form.flatten();
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      setDownloadResult({
        url,
        fileName: selectedFile.name.replace(/\.pdf$/i, "") + "-rellenado.pdf",
        mimeType: "application/pdf",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Error al procesar el formulario.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function handleValueChange(name: string, value: string | boolean) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleFillAndSave}
      disabled={!selectedFile || isProcessing || formFields.length === 0}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <ClipboardList data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Procesando" : "Guardar PDF"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF con formularios"
      emptyDescription="Sube un archivo PDF interactivo para rellenar sus campos y aplanarlo."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full bg-card rounded-xl border flex-col p-6 overflow-y-auto">
            <h2 className="text-xl font-medium mb-4">Campos del Formulario</h2>
            {formFields.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center h-full">
                No se encontraron campos interactivos.
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-2xl">
                {formFields.map((field) => (
                  <div
                    key={field.name}
                    className="flex flex-col gap-1 border-b pb-4"
                  >
                    <label className="text-sm font-medium text-foreground">
                      {field.name}
                    </label>
                    {field.type === "text" && (
                      <input
                        type="text"
                        value={(formValues[field.name] as string) || ""}
                        onChange={(e) =>
                          handleValueChange(field.name, e.target.value)
                        }
                        className="border rounded px-3 py-2 bg-background focus:ring-2 focus:ring-brand"
                      />
                    )}
                    {field.type === "checkbox" && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(formValues[field.name] as boolean) || false}
                          onChange={(e) =>
                            handleValueChange(field.name, e.target.checked)
                          }
                          className="size-5 text-brand"
                        />
                        <span className="text-sm text-muted-foreground">
                          Marcar
                        </span>
                      </label>
                    )}
                    {field.type === "radio" && (
                      <div className="flex flex-col gap-1">
                        {field.options?.map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={field.name}
                              checked={formValues[field.name] === opt}
                              onChange={() =>
                                handleValueChange(field.name, opt)
                              }
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {field.type === "dropdown" && (
                      <select
                        value={(formValues[field.name] as string) || ""}
                        onChange={(e) =>
                          handleValueChange(field.name, e.target.value)
                        }
                        className="border rounded px-3 py-2 bg-background focus:ring-2 focus:ring-brand"
                      >
                        <option value="">Seleccionar...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Formularios PDF"
      sidebarDescription="Rellena un documento PDF y aplanalo para que no se modifique."
      sidebar={
        <div className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>1. Sube tu PDF con formulario.</p>
          <p>2. Rellena los datos en la vista central.</p>
          <p>3. Elige si quieres aplanar el PDF (recomendado para enviar).</p>
          <label className="flex items-center gap-2 cursor-pointer bg-muted p-2 rounded border">
            <input
              type="checkbox"
              checked={flatten}
              onChange={(e) => setFlatten(e.target.checked)}
            />
            <span className="text-foreground">
              Aplanar (Flatten) al guardar
            </span>
          </label>
        </div>
      }
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner downloadResult={downloadResult} />
        ) : null
      }
    />
  );
}
