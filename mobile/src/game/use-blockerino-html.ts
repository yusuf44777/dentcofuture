import { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

const blockerinoHtmlAsset = require("../../assets/blockerino/index.html") as number;

export function useBlockerinoHtml(reloadKey = 0) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadHtml() {
      setLoading(true);
      setError(null);
      setHtml("");

      try {
        const asset = Asset.fromModule(blockerinoHtmlAsset);
        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        if (!uri) {
          throw new Error("Blockerino dosyası bulunamadı.");
        }

        const nextHtml = await FileSystem.readAsStringAsync(uri);
        if (!mounted) return;

        setHtml(nextHtml);
        setLoading(false);
      } catch (loadError) {
        if (!mounted) return;

        setError(loadError instanceof Error ? loadError.message : "Blockerino açılamadı.");
        setLoading(false);
      }
    }

    void loadHtml();

    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  return { html, loading, error };
}
