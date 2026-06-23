// Embeds document fonts into pdfmake on demand. TTFs come from
// @expo-google-fonts (Vite serves them as asset URLs); we fetch + base64 only
// the families a given document actually uses, then cache.

// ── Sans ──────────────────────────────────────────────────────────────────
import InterR from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import InterB from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf?url';
import InterI from '@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf?url';
import InterBI from '@expo-google-fonts/inter/700Bold_Italic/Inter_700Bold_Italic.ttf?url';
import RobotoR from '@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf?url';
import RobotoB from '@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf?url';
import RobotoI from '@expo-google-fonts/roboto/400Regular_Italic/Roboto_400Regular_Italic.ttf?url';
import RobotoBI from '@expo-google-fonts/roboto/700Bold_Italic/Roboto_700Bold_Italic.ttf?url';
import OpenSansR from '@expo-google-fonts/open-sans/400Regular/OpenSans_400Regular.ttf?url';
import OpenSansB from '@expo-google-fonts/open-sans/700Bold/OpenSans_700Bold.ttf?url';
import OpenSansI from '@expo-google-fonts/open-sans/400Regular_Italic/OpenSans_400Regular_Italic.ttf?url';
import OpenSansBI from '@expo-google-fonts/open-sans/700Bold_Italic/OpenSans_700Bold_Italic.ttf?url';
import LatoR from '@expo-google-fonts/lato/400Regular/Lato_400Regular.ttf?url';
import LatoB from '@expo-google-fonts/lato/700Bold/Lato_700Bold.ttf?url';
import LatoI from '@expo-google-fonts/lato/400Regular_Italic/Lato_400Regular_Italic.ttf?url';
import LatoBI from '@expo-google-fonts/lato/700Bold_Italic/Lato_700Bold_Italic.ttf?url';
import WorkSansR from '@expo-google-fonts/work-sans/400Regular/WorkSans_400Regular.ttf?url';
import WorkSansB from '@expo-google-fonts/work-sans/700Bold/WorkSans_700Bold.ttf?url';
import WorkSansI from '@expo-google-fonts/work-sans/400Regular_Italic/WorkSans_400Regular_Italic.ttf?url';
import WorkSansBI from '@expo-google-fonts/work-sans/700Bold_Italic/WorkSans_700Bold_Italic.ttf?url';

// ── Serif ─────────────────────────────────────────────────────────────────
import LoraR from '@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf?url';
import LoraB from '@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf?url';
import LoraI from '@expo-google-fonts/lora/400Regular_Italic/Lora_400Regular_Italic.ttf?url';
import LoraBI from '@expo-google-fonts/lora/700Bold_Italic/Lora_700Bold_Italic.ttf?url';
import MerriR from '@expo-google-fonts/merriweather/400Regular/Merriweather_400Regular.ttf?url';
import MerriB from '@expo-google-fonts/merriweather/700Bold/Merriweather_700Bold.ttf?url';
import MerriI from '@expo-google-fonts/merriweather/400Regular_Italic/Merriweather_400Regular_Italic.ttf?url';
import MerriBI from '@expo-google-fonts/merriweather/700Bold_Italic/Merriweather_700Bold_Italic.ttf?url';
import PlayfairR from '@expo-google-fonts/playfair-display/400Regular/PlayfairDisplay_400Regular.ttf?url';
import PlayfairB from '@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf?url';
import PlayfairI from '@expo-google-fonts/playfair-display/400Regular_Italic/PlayfairDisplay_400Regular_Italic.ttf?url';
import PlayfairBI from '@expo-google-fonts/playfair-display/700Bold_Italic/PlayfairDisplay_700Bold_Italic.ttf?url';
import PTSerifR from '@expo-google-fonts/pt-serif/400Regular/PTSerif_400Regular.ttf?url';
import PTSerifB from '@expo-google-fonts/pt-serif/700Bold/PTSerif_700Bold.ttf?url';
import PTSerifI from '@expo-google-fonts/pt-serif/400Regular_Italic/PTSerif_400Regular_Italic.ttf?url';
import PTSerifBI from '@expo-google-fonts/pt-serif/700Bold_Italic/PTSerif_700Bold_Italic.ttf?url';
import SourceSerifR from '@expo-google-fonts/source-serif-4/400Regular/SourceSerif4_400Regular.ttf?url';
import SourceSerifB from '@expo-google-fonts/source-serif-4/700Bold/SourceSerif4_700Bold.ttf?url';
import SourceSerifI from '@expo-google-fonts/source-serif-4/400Regular_Italic/SourceSerif4_400Regular_Italic.ttf?url';
import SourceSerifBI from '@expo-google-fonts/source-serif-4/700Bold_Italic/SourceSerif4_700Bold_Italic.ttf?url';

// ── Mono ──────────────────────────────────────────────────────────────────
import MonoR from '@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf?url';
import MonoB from '@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf?url';
import MonoI from '@expo-google-fonts/jetbrains-mono/400Regular_Italic/JetBrainsMono_400Regular_Italic.ttf?url';
import MonoBI from '@expo-google-fonts/jetbrains-mono/700Bold_Italic/JetBrainsMono_700Bold_Italic.ttf?url';
import SCPR from '@expo-google-fonts/source-code-pro/400Regular/SourceCodePro_400Regular.ttf?url';
import SCPB from '@expo-google-fonts/source-code-pro/700Bold/SourceCodePro_700Bold.ttf?url';
import SCPI from '@expo-google-fonts/source-code-pro/400Regular_Italic/SourceCodePro_400Regular_Italic.ttf?url';
import SCPBI from '@expo-google-fonts/source-code-pro/700Bold_Italic/SourceCodePro_700Bold_Italic.ttf?url';
import IBMR from '@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf?url';
import IBMB from '@expo-google-fonts/ibm-plex-mono/700Bold/IBMPlexMono_700Bold.ttf?url';
import IBMI from '@expo-google-fonts/ibm-plex-mono/400Regular_Italic/IBMPlexMono_400Regular_Italic.ttf?url';
import IBMBI from '@expo-google-fonts/ibm-plex-mono/700Bold_Italic/IBMPlexMono_700Bold_Italic.ttf?url';
import RobotoMonoR from '@expo-google-fonts/roboto-mono/400Regular/RobotoMono_400Regular.ttf?url';
import RobotoMonoB from '@expo-google-fonts/roboto-mono/700Bold/RobotoMono_700Bold.ttf?url';
import RobotoMonoI from '@expo-google-fonts/roboto-mono/400Regular_Italic/RobotoMono_400Regular_Italic.ttf?url';
import RobotoMonoBI from '@expo-google-fonts/roboto-mono/700Bold_Italic/RobotoMono_700Bold_Italic.ttf?url';
import FiraR from '@expo-google-fonts/fira-code/400Regular/FiraCode_400Regular.ttf?url';
import FiraB from '@expo-google-fonts/fira-code/700Bold/FiraCode_700Bold.ttf?url';

// pdfmake font key → { style: [vfs filename, asset url] }. Fira Code ships no
// italics, so its italic styles point at the upright files (upright code is fine).
const FONT_SPEC = {
  Inter: { normal: ['Inter-R.ttf', InterR], bold: ['Inter-B.ttf', InterB], italics: ['Inter-I.ttf', InterI], bolditalics: ['Inter-BI.ttf', InterBI] },
  Roboto: { normal: ['Roboto-R.ttf', RobotoR], bold: ['Roboto-B.ttf', RobotoB], italics: ['Roboto-I.ttf', RobotoI], bolditalics: ['Roboto-BI.ttf', RobotoBI] },
  OpenSans: { normal: ['OpenSans-R.ttf', OpenSansR], bold: ['OpenSans-B.ttf', OpenSansB], italics: ['OpenSans-I.ttf', OpenSansI], bolditalics: ['OpenSans-BI.ttf', OpenSansBI] },
  Lato: { normal: ['Lato-R.ttf', LatoR], bold: ['Lato-B.ttf', LatoB], italics: ['Lato-I.ttf', LatoI], bolditalics: ['Lato-BI.ttf', LatoBI] },
  WorkSans: { normal: ['WorkSans-R.ttf', WorkSansR], bold: ['WorkSans-B.ttf', WorkSansB], italics: ['WorkSans-I.ttf', WorkSansI], bolditalics: ['WorkSans-BI.ttf', WorkSansBI] },
  Lora: { normal: ['Lora-R.ttf', LoraR], bold: ['Lora-B.ttf', LoraB], italics: ['Lora-I.ttf', LoraI], bolditalics: ['Lora-BI.ttf', LoraBI] },
  Merriweather: { normal: ['Merri-R.ttf', MerriR], bold: ['Merri-B.ttf', MerriB], italics: ['Merri-I.ttf', MerriI], bolditalics: ['Merri-BI.ttf', MerriBI] },
  PlayfairDisplay: { normal: ['Playfair-R.ttf', PlayfairR], bold: ['Playfair-B.ttf', PlayfairB], italics: ['Playfair-I.ttf', PlayfairI], bolditalics: ['Playfair-BI.ttf', PlayfairBI] },
  PTSerif: { normal: ['PTSerif-R.ttf', PTSerifR], bold: ['PTSerif-B.ttf', PTSerifB], italics: ['PTSerif-I.ttf', PTSerifI], bolditalics: ['PTSerif-BI.ttf', PTSerifBI] },
  SourceSerif4: { normal: ['SourceSerif-R.ttf', SourceSerifR], bold: ['SourceSerif-B.ttf', SourceSerifB], italics: ['SourceSerif-I.ttf', SourceSerifI], bolditalics: ['SourceSerif-BI.ttf', SourceSerifBI] },
  JetBrainsMono: { normal: ['JBMono-R.ttf', MonoR], bold: ['JBMono-B.ttf', MonoB], italics: ['JBMono-I.ttf', MonoI], bolditalics: ['JBMono-BI.ttf', MonoBI] },
  SourceCodePro: { normal: ['SCP-R.ttf', SCPR], bold: ['SCP-B.ttf', SCPB], italics: ['SCP-I.ttf', SCPI], bolditalics: ['SCP-BI.ttf', SCPBI] },
  IBMPlexMono: { normal: ['IBM-R.ttf', IBMR], bold: ['IBM-B.ttf', IBMB], italics: ['IBM-I.ttf', IBMI], bolditalics: ['IBM-BI.ttf', IBMBI] },
  RobotoMono: { normal: ['RobotoMono-R.ttf', RobotoMonoR], bold: ['RobotoMono-B.ttf', RobotoMonoB], italics: ['RobotoMono-I.ttf', RobotoMonoI], bolditalics: ['RobotoMono-BI.ttf', RobotoMonoBI] },
  FiraCode: { normal: ['Fira-R.ttf', FiraR], bold: ['Fira-B.ttf', FiraB], italics: ['Fira-R.ttf', FiraR], bolditalics: ['Fira-B.ttf', FiraB] },
};

// Binary → base64 via FileReader: bulletproof for large buffers (manual
// String.fromCharCode chunking can corrupt/truncate big fonts in some engines).
async function fetchBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load font: ${url}`);
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const base64 = String(dataUrl).split(',')[1];
  if (!base64) throw new Error(`Empty font data: ${url}`);
  return base64;
}

const fileCache = {}; // vfs filename → base64 (persist across exports)

// Load + embed only the requested families. Returns { vfs, fonts, loaded:[] }.
export async function loadDocumentFonts(neededFamilies) {
  // An explicit empty array means "load no custom fonts". Only an omitted
  // argument loads the complete registry.
  const requested = Array.isArray(neededFamilies) ? neededFamilies : Object.keys(FONT_SPEC);
  const families = requested.filter((family) => FONT_SPEC[family]);
  const vfs = {};
  const fonts = {};
  const loaded = [];
  for (const family of families) {
    const definition = {};
    for (const [style, [filename, url]] of Object.entries(FONT_SPEC[family])) {
      if (!fileCache[filename]) fileCache[filename] = await fetchBase64(url);
      vfs[filename] = fileCache[filename];
      definition[style] = filename;
    }
    fonts[family] = definition;
    loaded.push(family);
  }
  return { vfs, fonts, loaded };
}
