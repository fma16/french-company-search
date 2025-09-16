import { Action, ActionPanel, Detail, Icon, Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { CompanyData } from "../types";
import { buildMarkdownAsync, markdownToHtml, markdownToPlainText } from "../lib/markdown-builder";
import { CompanyMetadata } from "./CompanyMetadata";
import { buildPappersSearchUrl } from "../lib/link-builder";

interface CompanyDetailsViewProps {
  data: CompanyData;
}

export function CompanyDetailsView({ data }: CompanyDetailsViewProps) {
  const { data: markdown, isLoading } = usePromise(
    async (companyData: CompanyData) => await buildMarkdownAsync(companyData),
    [data],
  );

  const displayMarkdown = markdown || "Loading company information...";
  const pappersUrl = buildPappersSearchUrl({
    siren: data.formality?.siren,
    denomination:
      data.formality.content.personneMorale?.denomination ??
      data.formality.content.personneMorale?.identite?.entreprise?.denomination ??
      null,
  });

  return (
    <Detail
      markdown={displayMarkdown}
      isLoading={isLoading}
      metadata={<CompanyMetadata data={data} />}
      actions={
        markdown ? (
          <ActionPanel>
            {pappersUrl ? (
              <Action.OpenInBrowser
                title="Ouvrir Sur Pappers"
                url={pappersUrl}
                shortcut={{ modifiers: ["cmd"], key: "enter" }}
              />
            ) : (
              <Action
                title="Ouvrir Sur Pappers"
                icon={Icon.ExclamationMark}
                shortcut={{ modifiers: ["cmd"], key: "enter" }}
                onAction={async () => {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Identifiant indisponible",
                    message: "Impossible d'ouvrir la fiche Pappers pour cette entreprise.",
                  });
                }}
              />
            )}
            <Action.CopyToClipboard
              title="Copy to Clipboard"
              content={{
                html: markdownToHtml(markdown),
                text: markdownToPlainText(markdown),
              }}
            />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
