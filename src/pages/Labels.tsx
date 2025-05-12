import {
  Field,
  Label as HeadlessLabel,
  Input,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { ChevronDownIcon, MinusIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FaAlignCenter,
  FaAlignLeft,
  FaAlignRight,
  FaArrowDown,
  FaArrowUp,
  FaEye,
  FaEyeSlash,
  FaGripLines,
  FaItalic,
  FaPlus,
  FaTextHeight,
  FaTrash,
} from "react-icons/fa";
import { useDispatch, useSelector, useStore } from "react-redux";
import { RootState } from "../store";
import {
  addStat,
  removeStat,
  reorderStat,
  setDescription,
  setDescriptionVisibility,
  setTitle,
  setTitleVisibility,
  updateLabelStyle,
  updateStat,
  updateStatStyle,
} from "../store/labelsSlice";

// Tooltip Import
import { Tooltip } from "react-tooltip";

// Tiptap imports
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Dnd-kit imports
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Translation Import
import { useTranslation } from "react-i18next";

// Router imports
import { useNavigate } from "react-router-dom";
import CartLoaderOverlay from "../components/CartLoaderOverlay";
import { addPosterToCart } from "../store/cartSlice";

// --- Available Fonts ---
const AVAILABLE_FONTS = [
  { label: "ABYS", value: "'ABYS', sans-serif" },
  { label: "LOVELO", value: "'LOVELO', sans-serif" },
  { label: "Abril Fatface", value: "'Abril Fatface', serif" },
  { label: "Alegreya", value: "'Alegreya', serif" },
  { label: "Alegreya Sans", value: "'Alegreya Sans', sans-serif" },
  { label: "Aller", value: "'Aller', sans-serif" },
  { label: "Anonymous Pro", value: "'Anonymous Pro', monospace" },
  { label: "Apfel Grotezk", value: "'Apfel Grotezk', sans-serif" },
  { label: "Apfel Grotezk Brukt", value: "'Apfel Grotezk Brukt', sans-serif" },
  { label: "Archivo Black", value: "'Archivo Black', sans-serif" },
  { label: "Archivo Narrow", value: "'Archivo Narrow', sans-serif" },
  { label: "Arimo", value: "'Arimo', sans-serif" },
  { label: "Arvo", value: "'Arvo', serif" },
  { label: "Bangers", value: "'Bangers', cursive" },
  { label: "B612", value: "'B612', sans-serif" },
  { label: "Bad Script", value: "'Bad Script', cursive" },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
  { label: "Bernier", value: "'Bernier', serif" },
  { label: "Bernier Shade", value: "'Bernier Shade', serif" },
  { label: "BioRhyme", value: "'BioRhyme', serif" },
  { label: "Blackout Midnight", value: "'Blackout Midnight', sans-serif" },
  { label: "Blackout Sunrise", value: "'Blackout Sunrise', sans-serif" },
  { label: "Blackout Two AM", value: "'Blackout Two AM', sans-serif" },
  { label: "Budmo Jiggler", value: "'Budmo Jiggler', cursive" },
  { label: "Bungee", value: "'Bungee', sans-serif" },
  { label: "Bungee Inline", value: "'Bungee Inline', sans-serif" },
  { label: "Bungee Outline", value: "'Bungee Outline', sans-serif" },
  { label: "Bungee Shade", value: "'Bungee Shade', sans-serif" },
  { label: "Cabin", value: "'Cabin', sans-serif" },
  { label: "Cardo", value: "'Cardo', serif" },
  { label: "Cheque", value: "'Cheque', serif" },
  { label: "Chewy", value: "'Chewy', cursive" },
  { label: "Chivo", value: "'Chivo', sans-serif" },
  { label: "Chunk", value: "'Chunk', serif" },
  { label: "Concert One", value: "'Concert One', cursive" },
  { label: "Cormorant", value: "'Cormorant', serif" },
  { label: "Crimson Text", value: "'Crimson Text', serif" },
  { label: "Dancing Script", value: "'Dancing Script', cursive" },
  { label: "Domine", value: "'Domine', serif" },
  { label: "Eczar", value: "'Eczar', serif" },
  { label: "Edo", value: "'Edo', cursive" },
  { label: "Faster One", value: "'Faster One', cursive" },
  { label: "Fira Sans", value: "'Fira Sans', sans-serif" },
  { label: "Frank Ruhl Libre", value: "'Frank Ruhl Libre', serif" },
  { label: "Fredericka the Great", value: "'Fredericka the Great', cursive" },
  { label: "Fruktur", value: "'Fruktur', cursive" },
  { label: "Gagalin", value: "'Gagalin', cursive" },
  { label: "Germania One", value: "'Germania One', sans-serif" },
  {
    label: "Glacial Indifference",
    value: "'Glacial Indifference', sans-serif",
  },
  { label: "Godoia", value: "'Godoia', serif" },
  { label: "Godoia Deco", value: "'Godoia Deco', serif" },
  { label: "Goudy Bookletter 1911", value: "'Goudy Bookletter 1911', serif" },
  { label: "Graduate", value: "'Graduate', serif" },
  { label: "Guerrilla", value: "'Guerrilla', cursive" },
  { label: "IBM Plex Sans", value: "'IBM Plex Sans', sans-serif" },
  { label: "Inconsolata", value: "'Inconsolata', monospace" },
  { label: "Inknut Antiqua", value: "'Inknut Antiqua', serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Josefin Sans", value: "'Josefin Sans', sans-serif" },
  { label: "Karla", value: "'Karla', sans-serif" },
  { label: "Knewave", value: "'Knewave', cursive" },
  { label: "Kontanter", value: "'Kontanter', sans-serif" },
  { label: "Lato", value: "'Lato', sans-serif" },
  { label: "League Gothic", value: "'League Gothic', sans-serif" },
  {
    label: "League Gothic Condensed",
    value: "'League Gothic Condensed', sans-serif",
  },
  { label: "League Mono", value: "'League Mono', monospace" },
  { label: "League Script", value: "'League Script', cursive" },
  { label: "League Spartan", value: "'League Spartan', sans-serif" },
  { label: "Libre Baskerville", value: "'Libre Baskerville', serif" },
  { label: "Libre Franklin", value: "'Libre Franklin', sans-serif" },
  { label: "Lora", value: "'Lora', serif" },
  { label: "Lot", value: "'Lot', sans-serif" },
  { label: "Lovelo", value: "'Lovelo', sans-serif" },
  { label: "Merriweather", value: "'Merriweather', serif" },
  { label: "Messapia", value: "'Messapia', serif" },
  { label: "Modak", value: "'Modak', cursive" },
  { label: "Monoton", value: "'Monoton', cursive" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Neuton", value: "'Neuton', serif" },
  { label: "New Rocker", value: "'New Rocker', cursive" },
  { label: "Norwester", value: "'Norwester', sans-serif" },
  { label: "Nunito Sans", value: "'Nunito Sans', sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
  { label: "Orbitron", value: "'Orbitron', sans-serif" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Peace Sans", value: "'Peace Sans', sans-serif" },
  { label: "Perfograma", value: "'Perfograma', monospace" },
  { label: "Permanent Marker", value: "'Permanent Marker', cursive" },
  { label: "Pirata One", value: "'Pirata One', cursive" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Playlist", value: "'Playlist', cursive" },
  { label: "Playlist Caps", value: "'Playlist Caps', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Proza Libre", value: "'Proza Libre', sans-serif" },
  { label: "PT Sans", value: "'PT Sans', sans-serif" },
  { label: "PT Serif", value: "'PT Serif', serif" },
  { label: "Rakkas", value: "'Rakkas', cursive" },
  { label: "Raleway", value: "'Raleway', sans-serif" },
  { label: "Repekt", value: "'Repekt', cursive" },
  { label: "Ribes", value: "'Ribes', cursive" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Roboto Slab", value: "'Roboto Slab', serif" },
  { label: "Rozha One", value: "'Rozha One', serif" },
  { label: "Rubik", value: "'Rubik', sans-serif" },
  { label: "Rubik Mono One", value: "'Rubik Mono One', sans-serif" },
  { label: "Sacramento", value: "'Sacramento', cursive" },
  { label: "Selima", value: "'Selima', cursive" },
  { label: "Shrikhand", value: "'Shrikhand', cursive" },
  { label: "Sifonn", value: "'Sifonn', sans-serif" },
  { label: "Sifonn Outline", value: "'Sifonn Outline', sans-serif" },
  { label: "Sigmar One", value: "'Sigmar One', cursive" },
  { label: "Solena", value: "'Solena', cursive" },
  { label: "Source Sans Pro", value: "'Source Sans Pro', sans-serif" },
  { label: "Source Serif Pro", value: "'Source Serif Pro', serif" },
  { label: "Space Mono", value: "'Space Mono', monospace" },
  { label: "Spartan", value: "'Spartan', sans-serif" },
  { label: "Spectral", value: "'Spectral', serif" },
  { label: "Sunday", value: "'Sunday', cursive" },
  { label: "Tenor Sans", value: "'Tenor Sans', sans-serif" },
  {
    label: "Typeface Claire-Obscure",
    value: "'Typeface Claire-Obscure', sans-serif",
  },
  { label: "Typeface Pleine", value: "'Typeface Pleine', sans-serif" },
  { label: "Ultra", value: "'Ultra', serif" },
  { label: "UnifrakturCook", value: "'UnifrakturCook', cursive" },
  { label: "UnifrakturMaguntia", value: "'UnifrakturMaguntia', cursive" },
  { label: "Varela", value: "'Varela', sans-serif" },
  { label: "Varela Round", value: "'Varela Round', sans-serif" },
  { label: "Vollkorn", value: "'Vollkorn', serif" },
  { label: "Work Sans", value: "'Work Sans', sans-serif" },
  { label: "Yatra One", value: "'Yatra One', cursive" },
];

// --- Available Font Weights ---
const AVAILABLE_FONT_WEIGHTS = [
  { name: "light", value: 300 },
  { name: "normal", value: 400 },
  { name: "medium", value: 500 },
  { name: "bold", value: 600 },
  { name: "extrabold", value: 700 },
  { name: "black", value: 800 },
];

// --- Stat Default Color Fallback ---
const DEFAULT_STAT_COLOR = "#333333"; // Kept for logic, Tailwind for styling

// --- BASE STYLES FOR UI ELEMENTS ---
const baseInputClasses =
  "block w-full rounded-md border-0 bg-neutral-800/80 py-1.5 px-3 text-sm shadow-sm ring-1 ring-inset ring-neutral-700/50 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-white placeholder:text-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed";
const baseIconButtonClasses =
  "relative inline-flex items-center justify-center p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700/80 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
const activeIconButtonClasses = "bg-blue-600 text-white hover:bg-blue-700";
const baseDropdownButtonClasses =
  "relative w-full cursor-default rounded-md bg-neutral-800/80 py-1.5 pl-3 pr-10 text-left text-white shadow-sm ring-1 ring-inset ring-neutral-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm sm:leading-6 disabled:opacity-50 disabled:cursor-not-allowed";
const baseDropdownOptionsContainerClasses =
  "absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md bg-neutral-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm";
const baseDropdownOptionClasses = ({ active }: { active: boolean }) =>
  clsx(
    "relative cursor-default select-none py-2 pl-3 pr-9",
    active ? "bg-blue-600 text-white" : "text-neutral-200"
  );
const sectionContainerClasses =
  "space-y-3 rounded-lg border border-neutral-700/50 bg-neutral-800/40 p-2 w-[260px]";

// --- États pour le collapse des blocs ---
// (Supprimé ici, voir plus bas dans le composant principal)

// --- SortableItem composant utilitaire pour DnD des stats ---
type SortableItemProps = {
  id: string;
  children: React.ReactNode;
};
const SortableItem: React.FC<SortableItemProps> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-2 bg-neutral-700/40 p-1.5 rounded-md border border-neutral-700/60"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab text-neutral-500 hover:text-neutral-300 px-1 py-1"
      >
        <FaGripLines className="w-4 h-4" />
      </div>
      <div className="flex-grow flex items-center gap-x-2">{children}</div>
    </div>
  );
};

// --- Simple Rich Text Editor Component (Title/Description) ---
type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";
interface SimpleEditorStyle {
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  isItalic: boolean;
  textAlign: "left" | "center" | "right" | "justify";
  marginTop: number;
  marginBottom: number;
  textTransform: TextTransform;
}
interface SimpleEditorProps {
  identifier: "title" | "description";
  content: string;
  isVisible: boolean;
  style: SimpleEditorStyle;
}

const SimpleEditor: React.FC<SimpleEditorProps> = ({
  identifier,
  content,
  isVisible,
  style,
}) => {
  const dispatch = useDispatch();
  const editorRef = useRef<Editor | null>(null);
  // Add state and ref for the color picker popover within SimpleEditor
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerPopoverRef = useRef<HTMLDivElement | null>(null);
  // --- AJOUT: Ref pour le debounce de la couleur ---
  const debounceColorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Ajout pour la traduction
  const { t } = useTranslation();

  const dispatchStyleUpdate = useCallback(
    (updates: Partial<SimpleEditorStyle>) =>
      dispatch(updateLabelStyle({ labelType: identifier, updates })),
    [dispatch, identifier]
  );
  const dispatchContentUpdate = useCallback(
    (htmlContent: string) => {
      if (identifier === "title") dispatch(setTitle(htmlContent));
      else dispatch(setDescription(htmlContent));
    },
    [dispatch, identifier]
  );
  const handleVisibilityToggle = useCallback(() => {
    if (identifier === "title") dispatch(setTitleVisibility(!isVisible));
    else dispatch(setDescriptionVisibility(!isVisible));
  }, [dispatch, identifier, isVisible]);

  const editorInstance = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          strike: false,
          code: false,
          bold: false,
          italic: {},
        }),
        TextStyle,
        Color.configure({ types: [TextStyle.name] }),
        FontFamily.configure({ types: [TextStyle.name] }),
        TextAlign.configure({ types: ["paragraph"] }),
      ],
      content: content,
      onUpdate: ({ editor: updatedEditor }) => {
        const currentHTML = updatedEditor.getHTML();
        if (currentHTML !== content) dispatchContentUpdate(currentHTML);
      },
      editable: isVisible,
    },
    [isVisible]
  );

  useEffect(() => {
    editorRef.current = editorInstance;
    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
      // --- AJOUT: Nettoyer le timeout du debounce ---
      if (debounceColorTimeoutRef.current) {
        clearTimeout(debounceColorTimeoutRef.current);
      }
    };
  }, [editorInstance]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed && editor.isEditable) {
      const editorHTML = editor.getHTML();
      if (content !== editorHTML && !editor.isFocused) {
        editor.commands.setContent(content, false);
      }
    }
  }, [content]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed || !editor.isEditable) return;
    let needsRun = false;
    const chain = editor.chain();
    const isEditorItalic = editor.isActive("italic");
    if (isEditorItalic !== style.isItalic) {
      chain.toggleItalic();
      needsRun = true;
    }
    const currentAlign =
      ["left", "center", "right", "justify"].find((align) =>
        editor.isActive({ textAlign: align })
      ) || "left";
    if (currentAlign !== style.textAlign) {
      chain.setTextAlign(style.textAlign);
      needsRun = true;
    }
    const currentFontFamily =
      editor.getAttributes("textStyle").fontFamily || "";
    if (currentFontFamily !== style.fontFamily) {
      // Sélectionner tout le texte avant d'appliquer la police
      chain.selectAll().setFontFamily(style.fontFamily);
      needsRun = true;
    }
    if (needsRun) {
      chain.run();
    }
  }, [style, editorInstance, identifier]);

  // NEW Effect for handling clicks outside the SimpleEditor color picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorPickerPopoverRef.current &&
        !colorPickerPopoverRef.current.contains(event.target as Node)
      ) {
        // Check if the click target was the button that opens the picker
        const clickedButton = (event.target as Element).closest(
          `button[aria-label="Couleur du texte"][data-editor-id="${identifier}"]`
        );
        if (!clickedButton) {
          setIsColorPickerOpen(false); // Close picker if click is outside and not on its trigger button
        }
      }
    };
    if (isColorPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isColorPickerOpen, identifier]); // Rerun when picker opens/closes or identifier changes

  // --- AJOUT: Fonction de mise à jour déboncée pour la couleur ---
  const debounceColorUpdate = useCallback(
    (newColor: string) => {
      if (debounceColorTimeoutRef.current) {
        clearTimeout(debounceColorTimeoutRef.current);
      }
      debounceColorTimeoutRef.current = setTimeout(() => {
        // On ne dispatch que si la couleur a réellement changé par rapport au style actuel
        // pour éviter des dispatches inutiles si l'utilisateur revient à la couleur initiale.
        if (newColor !== style.color) {
          dispatchStyleUpdate({ color: newColor });
        }
      }, 10); // Délai réduit à 10ms pour une réaction immédiate
    },
    [dispatchStyleUpdate, style.color]
  ); // Dépendances: la fonction de dispatch et la couleur actuelle

  if (!editorInstance) return null;

  const toggleButtonClasses = (active: boolean) =>
    clsx(baseIconButtonClasses, active && activeIconButtonClasses);
  const transformButtonClasses = (buttonTransform: TextTransform) =>
    clsx(
      baseIconButtonClasses,
      style.textTransform === buttonTransform && activeIconButtonClasses
    );
  const currentWeightName = t(
    `labels.weight_${
      AVAILABLE_FONT_WEIGHTS.find((fw) => fw.value === style.fontWeight)
        ?.name || "normal"
    }`
  );

  // ** CORRECTION: Tooltip application: Only on the final interactive element **
  return (
    <div className="space-y-2 mt-3">
      {/* Toolbar Container */}
      <div
        className={clsx(
          "flex flex-col flex-wrap gap-2 rounded-md border border-neutral-700/50 bg-neutral-800/40 p-2"
        )}
      >
        {/* Ligne 1: Icônes */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {/* Visibilité */}
          <button
            onClick={handleVisibilityToggle}
            className={clsx(baseIconButtonClasses)}
            id={`tooltip-${identifier}-visibility`}
            data-tooltip-id={`tooltip-${identifier}-visibility`}
            data-tooltip-content={isVisible ? "Cacher" : "Afficher"}
          >
            {isVisible ? (
              <FaEye className="w-4 h-4" />
            ) : (
              <FaEyeSlash className="w-4 h-4" />
            )}
          </button>
          {/* Autres icônes (avec opacité si non visible) */}
          <div
            className={clsx(
              "flex flex-wrap items-center gap-y-1",
              !isVisible && "opacity-60"
            )}
          >
            {/* Transform */}
            <div className="inline-flex rounded-md space-x-2 shadow-sm">
              <button
                onClick={() =>
                  dispatchStyleUpdate({ textTransform: "uppercase" })
                }
                disabled={!isVisible}
                className={clsx(
                  transformButtonClasses("uppercase"),
                  "rounded-l-md"
                )}
                id={`tooltip-${identifier}-uppercase`}
                data-tooltip-id={`tooltip-${identifier}-uppercase`}
                data-tooltip-content="Majuscules"
              >
                {" "}
                <FaTextHeight className="w-4 h-4" />{" "}
              </button>
              <button
                onClick={() => dispatchStyleUpdate({ textTransform: "none" })}
                disabled={!isVisible}
                className={clsx(transformButtonClasses("none"), "rounded-r-md")}
                id={`tooltip-${identifier}-transform-none`}
                data-tooltip-id={`tooltip-${identifier}-transform-none`}
                data-tooltip-content="Normal (aucune transformation)"
              >
                {" "}
                <MinusIcon className="w-4 h-4" />{" "}
              </button>
            </div>
            {/* Italic */}
            <button
              onClick={() => dispatchStyleUpdate({ isItalic: !style.isItalic })}
              disabled={!isVisible}
              className={toggleButtonClasses(style.isItalic)}
              id={`tooltip-${identifier}-italic`}
              data-tooltip-id={`tooltip-${identifier}-italic`}
              data-tooltip-content="Italique"
            >
              {" "}
              <FaItalic className="w-4 h-4" />{" "}
            </button>
            {/* Align */}
            <div
              style={{ gap: "8px" }}
              className="inline-flex rounded-md shadow-sm"
            >
              <button
                onClick={() => dispatchStyleUpdate({ textAlign: "left" })}
                disabled={!isVisible}
                className={clsx(
                  toggleButtonClasses(style.textAlign === "left"),
                  "rounded-l-md"
                )}
                id={`tooltip-${identifier}-align-left`}
                data-tooltip-id={`tooltip-${identifier}-align-left`}
                data-tooltip-content="Aligner à gauche"
              >
                {" "}
                <FaAlignLeft className="w-4 h-4" />{" "}
              </button>
              <button
                onClick={() => dispatchStyleUpdate({ textAlign: "center" })}
                disabled={!isVisible}
                className={clsx(
                  toggleButtonClasses(style.textAlign === "center"),
                  "border-x border-neutral-600"
                )}
                id={`tooltip-${identifier}-align-center`}
                data-tooltip-id={`tooltip-${identifier}-align-center`}
                data-tooltip-content="Centrer"
              >
                {" "}
                <FaAlignCenter className="w-4 h-4" />{" "}
              </button>
              <button
                onClick={() => dispatchStyleUpdate({ textAlign: "right" })}
                disabled={!isVisible}
                className={clsx(
                  toggleButtonClasses(style.textAlign === "right"),
                  "rounded-r-md"
                )}
                id={`tooltip-${identifier}-align-right`}
                data-tooltip-id={`tooltip-${identifier}-align-right`}
                data-tooltip-content="Aligner à droite"
              >
                {" "}
                <FaAlignRight className="w-4 h-4" />{" "}
              </button>
            </div>
          </div>
        </div>

        {/* Ligne 2: Font Weight */}
        <div className={clsx(!isVisible && "opacity-60 pointer-events-none")}>
          <Listbox
            value={style.fontWeight}
            onChange={(value) => dispatchStyleUpdate({ fontWeight: value })}
            disabled={!isVisible}
          >
            <div className="relative w-full">
              {/* Tooltip sur le bouton */}
              <ListboxButton className={baseDropdownButtonClasses}>
                {" "}
                <span className="block truncate text-sm">
                  {currentWeightName}
                </span>{" "}
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  {" "}
                  <ChevronDownIcon className="h-5 w-5 text-neutral-400" />{" "}
                </span>{" "}
              </ListboxButton>
              <ListboxOptions className={baseDropdownOptionsContainerClasses}>
                {" "}
                {AVAILABLE_FONT_WEIGHTS.map((fw) => (
                  <ListboxOption
                    key={fw.value}
                    className={baseDropdownOptionClasses}
                    value={fw.value}
                  >
                    <>
                      <span className="block truncate">
                        {" "}
                        {t(`labels.weight_${fw.name}`)}
                      </span>{" "}
                    </>
                  </ListboxOption>
                ))}{" "}
              </ListboxOptions>
            </div>
          </Listbox>
        </div>

        {/* Ligne 3: Font Family */}
        <div className={clsx(!isVisible && "opacity-60 pointer-events-none")}>
          <Listbox
            value={
              style.fontFamily ||
              AVAILABLE_FONTS.find((f) => f.label === "Oswald")?.value
            }
            onChange={(value) => dispatchStyleUpdate({ fontFamily: value })}
            disabled={!isVisible}
          >
            <div className="relative w-full">
              {/* Tooltip sur le bouton */}
              <ListboxButton className={baseDropdownButtonClasses}>
                {" "}
                <span className="block truncate text-sm">
                  {AVAILABLE_FONTS.find(
                    (f) =>
                      f.value ===
                      (style.fontFamily ||
                        AVAILABLE_FONTS.find((f) => f.label === "Oswald")
                          ?.value)
                  )?.label || "Police"}
                </span>{" "}
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  {" "}
                  <ChevronDownIcon className="h-5 w-5 text-neutral-400" />{" "}
                </span>{" "}
              </ListboxButton>
              <ListboxOptions className={baseDropdownOptionsContainerClasses}>
                {" "}
                {AVAILABLE_FONTS.map((font) => (
                  <ListboxOption
                    key={font.value}
                    className={baseDropdownOptionClasses}
                    value={font.value}
                  >
                    <>
                      <span
                        className="block truncate"
                        style={{ fontFamily: font.value }}
                      >
                        {" "}
                        {font.label}{" "}
                      </span>{" "}
                    </>
                  </ListboxOption>
                ))}{" "}
              </ListboxOptions>
            </div>
          </Listbox>
        </div>

        {/* Ligne 4: Taille et Marges */}
        <div
          className={clsx(
            "flex flex-wrap items-center gap-x-1 gap-y-1",
            !isVisible && "opacity-60 pointer-events-none"
          )}
        >
          <div className="inline-flex items-center rounded-md bg-neutral-800/80 ring-1 ring-inset ring-neutral-700/50 shadow-sm divide-x divide-neutral-700/50">
            <Input
              type="number"
              aria-label="Taille de police"
              min="8"
              max="120"
              value={style.fontSize}
              onChange={(e) =>
                dispatchStyleUpdate({
                  fontSize: parseInt(e.target.value, 10) || style.fontSize,
                })
              }
              disabled={!isVisible}
              className="w-16 text-sm bg-transparent border-0 text-center text-white py-1.5 focus:ring-0"
              id={`tooltip-${identifier}-fontsize`}
              data-tooltip-id={`tooltip-${identifier}-fontsize`}
              data-tooltip-content="Taille de police (pixels)"
            />
            <div className="flex items-center pl-1.5">
              {" "}
              <span className="text-xs px-1 text-neutral-500 cursor-default">
                <FaArrowUp />
              </span>{" "}
              <Input
                type="number"
                aria-label="Marge haute"
                min="-50"
                max="100"
                value={style.marginTop}
                onChange={(e) =>
                  dispatchStyleUpdate({
                    marginTop: parseInt(e.target.value, 10) || 0,
                  })
                }
                disabled={!isVisible}
                className="w-14 text-sm bg-transparent border-0 text-center text-white py-1.5 pr-1 focus:ring-0"
                id={`tooltip-${identifier}-margintop`}
                data-tooltip-id={`tooltip-${identifier}-margintop`}
                data-tooltip-content="Marge haute (pixels)"
              />{" "}
            </div>
            <div className="flex items-center pl-1.5">
              {" "}
              <span className="text-xs px-1 text-neutral-500 cursor-default">
                <FaArrowDown />
              </span>{" "}
              <Input
                type="number"
                aria-label="Marge basse"
                min="-50"
                max="100"
                value={style.marginBottom}
                onChange={(e) =>
                  dispatchStyleUpdate({
                    marginBottom: parseInt(e.target.value, 10) || 0,
                  })
                }
                disabled={!isVisible}
                className="w-14 text-sm bg-transparent border-0 text-center text-white py-1.5 pr-1 focus:ring-0"
                id={`tooltip-${identifier}-marginbottom`}
                data-tooltip-id={`tooltip-${identifier}-marginbottom`}
                data-tooltip-content="Marge basse (pixels)"
              />{" "}
            </div>
          </div>
        </div>

        {/* Ligne 5: Color Button & Picker (Replaces Input) */}
        <div
          className={clsx(
            "relative w-full",
            !isVisible && "opacity-60 pointer-events-none"
          )}
        >
          {isVisible && (
            <input
              type="color"
              value={style.color || "#ffffff"}
              onChange={(e) => debounceColorUpdate(e.target.value)}
              className="h-8 w-full cursor-pointer appearance-none border border-white/10 rounded-md bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {/* Editeur Tiptap */}
      {/* ** CORRECTION: Hauteur dynamique, pas de min-h ** */}
      <div
        className={clsx(
          "block w-full rounded-md border border-neutral-700/50 bg-neutral-900/50 p-3 text-sm text-white focus-within:ring-1 focus-within:ring-blue-500",
          !isVisible && "opacity-50 bg-neutral-800/30 cursor-not-allowed"
        )}
      >
        <EditorContent
          editor={editorInstance}
          style={{
            color: "#FFFFFF !important",
            fontWeight: style.fontWeight,
            fontStyle: style.isItalic ? "italic" : "normal",
          }}
          className="outline-none prose prose-invert prose-sm max-w-none caret-white"
        />
      </div>
      {/* Tooltip Components for SimpleEditor */}
      <Tooltip
        id={`tooltip-${identifier}-visibility`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-uppercase`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-transform-none`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-italic`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-align-left`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-align-center`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-align-right`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-fontsize`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-margintop`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
      <Tooltip
        id={`tooltip-${identifier}-marginbottom`}
        place="top"
        opacity={1}
        style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
      />
    </div>
  );
};

// === NEW Memoized Stat Row Content Component ===
// Type for a single stat, derived from the Redux state structure
type StatItem = ReturnType<(state: RootState) => typeof state.labels.stats>[0];

interface StatRowContentProps {
  stat: StatItem; // Vient maintenant de l'état local du parent `localStats`
  index: number;
  handleLocalLabelChange: (index: number, value: string) => void; // Modifie localStats
  handleLocalValueChange: (index: number, value: string) => void; // Modifie localStats
  handleLocalStyleChange: (
    index: number,
    updates: Partial<StatItem["style"]>
  ) => void;
  handleSaveChanges: (index: number) => void; // Déclenche la sauvegarde Redux depuis localStats
  handleRemoveStat: (index: number) => void;
  debounceStyleUpdate: (
    index: number,
    changedUpdates: Partial<StatItem["style"]>
  ) => void;
}

const StatRowContent = React.memo<StatRowContentProps>(
  ({
    stat, // Reçoit la stat de localStats
    index,
    handleLocalLabelChange,
    handleLocalValueChange,
    handleLocalStyleChange,
    handleSaveChanges,
    handleRemoveStat,
    debounceStyleUpdate,
  }) => {
    // PAS besoin d'états locaux ici pour label/value
    // const [localLabel, setLocalLabel] = useState(stat.label);
    // const [localValue, setLocalValue] = useState(stat.value);
    // ... useEffect de synchro supprimés ...

    // Garder les états locaux pour les inputs avec debounce (taille, couleur)
    const [localInputColor, setLocalInputColor] = useState(
      stat.style?.color || DEFAULT_STAT_COLOR
    );
    const localColorDebounceTimeoutRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
    const [localInputFontSize, setLocalInputFontSize] = useState<string>(
      (stat.style?.fontSize || 16).toString()
    );
    const localSizeDebounceTimeoutRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

    // --- onChange appelle DIRECTEMENT les props du parent ---
    const onLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleLocalLabelChange(index, e.target.value); // Met à jour localStats DANS Labels
    };
    const onValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleLocalValueChange(index, e.target.value); // Met à jour localStats DANS Labels
    };

    // Handlers de style restent inchangés
    const onFontChange = (value: string) => {
      handleLocalStyleChange(index, { fontFamily: value });
      debounceStyleUpdate(index, { fontFamily: value });
    };
    const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value;
      setLocalInputColor(newColor);
      if (localColorDebounceTimeoutRef.current) {
        clearTimeout(localColorDebounceTimeoutRef.current);
      }
      localColorDebounceTimeoutRef.current = setTimeout(() => {
        handleLocalStyleChange(index, { color: newColor });
        debounceStyleUpdate(index, { color: newColor });
      }, 10); // 10ms debounce pour une réactivité maximale sans ralentir le UI
    };
    const handleSizeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      setLocalInputFontSize(rawValue);
      if (localSizeDebounceTimeoutRef.current) {
        clearTimeout(localSizeDebounceTimeoutRef.current);
      }
      localSizeDebounceTimeoutRef.current = setTimeout(() => {
        const newSize = parseInt(rawValue, 10);
        if (!isNaN(newSize) && newSize >= 8 && newSize <= 48) {
          handleLocalStyleChange(index, { fontSize: newSize });
          debounceStyleUpdate(index, { fontSize: newSize });
        } else {
          setLocalInputFontSize((stat.style?.fontSize || 16).toString());
        }
      }, 400);
    };

    // --- onBlur appelle le handler du parent ---
    const onBlur = () => handleSaveChanges(index);
    const onRemove = () => handleRemoveStat(index);

    return (
      <div className="flex flex-col gap-y-2 w-full">
        {/* Row 1: Label & Value Inputs */}
        <div className="flex gap-x-2 w-full">
          <div className="flex-1 min-w-[100px]">
            <Input
              placeholder="Libellé"
              // --- MODIFIÉ: Utiliser stat.label (qui vient de localStats) ---
              value={stat.label}
              onChange={onLabelChange} // Appelle handleLocalLabelChange
              onBlur={onBlur}
              className={clsx(
                baseInputClasses,
                "text-xs",
                "w-full",
                "text-white"
              )}
            />
          </div>
          <div className="flex-1 min-w-[80px]">
            <Input
              placeholder="Valeur"
              // --- MODIFIÉ: Utiliser stat.value (qui vient de localStats) ---
              value={stat.value}
              onChange={onValueChange} // Appelle handleLocalValueChange
              onBlur={onBlur}
              className={clsx(
                baseInputClasses,
                "text-xs",
                "w-full",
                "text-white"
              )}
            />
          </div>
        </div>
        {/* Row 2: Controls */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-2 w-full relative">
          {/* Font */}
          <div className="flex-1 min-w-[120px]">
            <Listbox
              value={
                stat.style?.fontFamily ||
                AVAILABLE_FONTS.find((f) => f.label === "Oswald")?.value
              }
              onChange={onFontChange}
            >
              <div className="relative">
                <ListboxButton
                  className={clsx(
                    baseDropdownButtonClasses,
                    "w-full py-1 text-xs pl-2 pr-5"
                  )}
                >
                  <span className="block truncate text-neutral-300">
                    {AVAILABLE_FONTS.find(
                      (f) =>
                        f.value ===
                        (stat.style?.fontFamily ||
                          AVAILABLE_FONTS.find((f) => f.label === "Oswald")
                            ?.value)
                    )?.label || "Police"}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                    {" "}
                    <ChevronDownIcon className="h-4 w-4 text-neutral-400" />{" "}
                  </span>{" "}
                </ListboxButton>
                <ListboxOptions
                  className={clsx(
                    baseDropdownOptionsContainerClasses,
                    "w-full"
                  )}
                >
                  {AVAILABLE_FONTS.map((font) => (
                    <ListboxOption
                      key={font.value}
                      value={font.value}
                      className={({ active }) =>
                        clsx(
                          "cursor-default select-none py-1 pl-2 pr-1 text-xs",
                          active ? "bg-blue-600 text-white" : "text-neutral-200"
                        )
                      }
                    >
                      <span
                        className="block truncate"
                        style={{ fontFamily: font.value }}
                      >
                        {font.label}
                      </span>
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Listbox>
          </div>
          {/* Size */}
          <Input
            type="number"
            title="Taille police stat."
            aria-label="Taille police stat."
            min="8"
            max="48"
            // --- MODIFIÉ: Utiliser l'état local et le nouveau handler ---
            value={localInputFontSize} // Utilise l'état local string
            onChange={handleSizeInputChange} // Utilise le handler déboncé
            /* --- SUPPRIMÉ: onBlur n'est plus nécessaire ici --- */
            // onBlur={???} // Plus géré ici
            className={clsx(
              baseInputClasses,
              "w-14 text-xs text-center px-1 py-1 flex-shrink-0"
            )}
          />
          {/* Color Button & Picker - Use props passed down */}
          <div className="relative flex-shrink-0">
            {/* --- MODIFIÉ: Utiliser l'état local et le nouveau handler --- */}
            <input
              type="color"
              value={localInputColor} // Utilise l'état local pour l'affichage
              onChange={handleColorInputChange} // Utilise le handler déboncé
              className="h-8 w-8 cursor-pointer appearance-none border border-white/10 rounded-md bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
            />
          </div>
          {/* Remove */}
          <button
            type="button"
            onClick={onRemove}
            className={clsx(
              baseIconButtonClasses,
              "text-neutral-500 hover:text-red-500",
              "ml-auto flex-shrink-0"
            )}
            id={`tooltip-stat-${index}-delete`}
            data-tooltip-id={`tooltip-stat-${index}-delete`}
            data-tooltip-content="Supprimer cette statistique"
          >
            <FaTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

// --- Composant principal des étiquettes ---
interface LabelsProps {
  mapEditorRef: React.RefObject<any>;
}

const Labels: React.FC<LabelsProps> = ({ mapEditorRef }) => {
  const dispatch = useDispatch();
  // --- NOUVEAU: Accéder au store pour getState dans le debounce ---
  const store = useStore<RootState>();
  const { title, description, stats } = useSelector(
    (state: RootState) => state.labels
  );
  // Ajout pour la traduction
  const { t } = useTranslation();

  // Collapse states for each section
  const [titleCollapsed, setTitleCollapsed] = useState(false);
  const [descriptionCollapsed, setDescriptionCollapsed] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(false);

  // State: Local copy of stats for editing
  const [localStats, setLocalStats] = useState(() =>
    stats.map((stat) => ({ ...stat, style: { ...(stat.style || {}) } }))
  );
  // Ref for debounce timer
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effect to sync localStats when Redux stats change
  useEffect(() => {
    setLocalStats(
      stats.map((stat) => ({ ...stat, style: { ...(stat.style || {}) } }))
    );
  }, [stats]);

  // --- Handlers for Local State Updates (passed to memoized component) ---
  const handleLocalLabelChange = useCallback((index: number, value: string) => {
    setLocalStats((current) => {
      const next = [...current];
      if (next[index]) next[index] = { ...next[index], label: value };
      return next;
    });
  }, []);

  const handleLocalValueChange = useCallback((index: number, value: string) => {
    setLocalStats((current) => {
      const next = [...current];
      if (next[index]) next[index] = { ...next[index], value: value };
      return next;
    });
  }, []);

  const handleLocalStyleChange = useCallback(
    (index: number, updates: Partial<StatItem["style"]>) => {
      setLocalStats((current) => {
        const next = [...current];
        if (next[index]) {
          const currentStyle = next[index].style || {};
          next[index] = {
            ...next[index],
            style: { ...currentStyle, ...updates },
          };
        }
        return next;
      });
    },
    []
  );

  // --- THIS IS THE DEBOUNCE HANDLER FOR REDUX STYLE UPDATES ---
  const debounceStyleUpdate = useCallback(
    (index: number, changedUpdates: Partial<StatItem["style"]>) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        // Lire l'état Redux actuel JUSTE AVANT le dispatch
        const currentReduxStats = store.getState().labels.stats;
        const originalReduxStyle = currentReduxStats[index]?.style || {};

        const updatesToDispatch: Partial<typeof originalReduxStyle> = {};
        let hasChanges = false;

        for (const key in changedUpdates) {
          if (Object.prototype.hasOwnProperty.call(changedUpdates, key)) {
            const styleKey = key as keyof typeof changedUpdates;
            const newValue = changedUpdates[styleKey]; // La nouvelle valeur proposée
            const originalValue = originalReduxStyle[styleKey];
            const effectiveOriginalValue =
              styleKey === "color" && originalValue === undefined
                ? DEFAULT_STAT_COLOR
                : originalValue;

            // Comparer la NOUVELLE valeur avec la valeur ACTUELLE dans Redux
            if (newValue !== effectiveOriginalValue) {
              (updatesToDispatch as any)[styleKey] = newValue;
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          console.log(
            `Dispatching debounced style update for index ${index}:`,
            updatesToDispatch
          );
          dispatch(updateStatStyle({ index, updates: updatesToDispatch }));
        }
      }, 800); // 800ms debounce delay
    },
    // ENLEVER localStats des dépendances, ajouter store
    [dispatch, store] // Dépend de dispatch et de store pour getState
  );

  // --- Handler for Saving Changes (on Blur) ---
  const handleSaveChanges = useCallback(
    (index: number) => {
      const local = localStats[index];
      const redux = stats[index];
      if (!local || !redux) return;

      // Save Label/Value if changed
      if (local.label !== redux.label || local.value !== redux.value) {
        console.log(
          `Dispatching label/value update on blur for index ${index}`
        );
        dispatch(updateStat({ index, label: local.label, value: local.value }));
      }

      // Save Non-Color Styles if changed
      const { color: localC, ...localStyleNoColor } = local.style || {};
      const { color: reduxC, ...reduxStyleNoColor } = redux.style || {};
      if (
        JSON.stringify(localStyleNoColor) !== JSON.stringify(reduxStyleNoColor)
      ) {
        console.log(
          `Dispatching non-color style update on blur for index ${index}`,
          localStyleNoColor
        );
        dispatch(updateStatStyle({ index, updates: localStyleNoColor }));
      }
    },
    [dispatch, stats, localStats]
  );

  // --- Handler for Removing Stat ---
  const handleRemoveStat = useCallback(
    (index: number) => {
      dispatch(removeStat(index));
    },
    [dispatch]
  );

  // --- DND Handlers (ensure localStats dependency is correct) ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.id !== over?.id && over?.id) {
        // Find indices based on the current localStats order
        const oldIndex = localStats.findIndex(
          (_, i) => `stat-${i}` === active.id
        );
        const newIndex = localStats.findIndex(
          (_, i) => `stat-${i}` === over.id
        );
        if (oldIndex !== -1 && newIndex !== -1) {
          // Dispatch reorder action to Redux FIRST
          dispatch(reorderStat({ startIndex: oldIndex, endIndex: newIndex }));
          // THEN update local state optimistically OR rely on useEffect sync
          // Let's rely on useEffect sync based on `stats` prop from Redux for simplicity
        }
      }
    },
    [dispatch, localStats]
  ); // Keep localStats for findIndex

  const handleAddStat = () => {
    dispatch(addStat({ label: "Nouvelle statistique", value: "Valeur" }));
  };

  // --- Hook pour ajuster la carte lors d'un changement de taille de texte ---
  // (Suppression de window.adjustMapAsync qui n'existe pas)
  // useEffect(() => {
  //   if (window && typeof window.adjustMapAsync === 'function') {
  //     window.adjustMapAsync();
  //   }
  // }, [title.style.fontSize, description.style.fontSize, stats.map(s => s.style?.fontSize).join(",")]);

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const navigate = useNavigate();
  const labels = useSelector((state: RootState) => state.labels);
  const points = useSelector((state: RootState) => state.points.points);
  const layout = useSelector((state: RootState) => state.layout);
  const map = useSelector((state: RootState) => state.map);
  const trace = useSelector((state: RootState) => state.trace);
  const profile = useSelector((state: RootState) => state.profile);
  const product = useSelector((state: RootState) => state.product);
  const activities = useSelector(
    (state: RootState) => state.activities.activities
  );
  const activeActivityIds = useSelector(
    (state: RootState) => state.activities.activeActivityIds
  );

  const handleAddToCart = async () => {
    if (!mapEditorRef?.current || !mapEditorRef.current.generatePreviewImage) {
      alert(
        "Erreur : Impossible d'accéder à l'éditeur ou à la carte pour générer l'aperçu."
      );
      return;
    }
    setIsAddingToCart(true);
    try {
      const thumbnailUrl = await mapEditorRef.current.generatePreviewImage();
      const { currentPrice: _, ...productDetails } = product;
      const productForCart = {
        ...productDetails,
        price: product.currentPrice,
      };
      const posterConfiguration = {
        labels,
        points,
        layout,
        map,
        trace,
        profile,
        product: productForCart,
        activeActivityIds,
        activitiesData: activities,
      };
      dispatch(
        addPosterToCart({
          id: `cart-${Date.now()}-${Math.random()
            .toString(16)
            .substring(2, 8)}`,
          configuration: posterConfiguration,
          thumbnailUrl: thumbnailUrl ?? undefined,
        })
      );
      navigate("/cart");
    } catch (error) {
      alert("Erreur lors de l'ajout au panier");
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-xl mx-auto md:max-w-none">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold font-sans text-white">
          {t("labels.title")}
        </h1>
        <p className="text-neutral-400 font-light text-sm">
          {t("labels.subtitle")}
        </p>
      </div>

      {/* Titre Section Collapsible */}
      <Field
        as="div"
        className={sectionContainerClasses}
      >
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setTitleCollapsed((prev) => !prev)}
        >
          <HeadlessLabel className="font-sans text-base font-medium text-white pb-3 flex-1">
            {t("labels.label_title")}
          </HeadlessLabel>
          <span
            className="ml-2 transition-transform"
            style={{
              transform: titleCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDownIcon className="h-5 w-5 text-neutral-400" />
          </span>
        </div>
        {!titleCollapsed && (
          <SimpleEditor
            identifier="title"
            content={title.text}
            isVisible={title.isVisible}
            style={title.style}
          />
        )}
      </Field>

      {/* Description Section Collapsible */}
      <Field
        as="div"
        className={sectionContainerClasses}
      >
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setDescriptionCollapsed((prev) => !prev)}
        >
          <HeadlessLabel className="font-sans text-base font-medium text-white pb-3 flex-1">
            {t("labels.label_description")}
          </HeadlessLabel>
          <span
            className="ml-2 transition-transform"
            style={{
              transform: descriptionCollapsed
                ? "rotate(-90deg)"
                : "rotate(0deg)",
            }}
          >
            <ChevronDownIcon className="h-5 w-5 text-neutral-400" />
          </span>
        </div>
        {!descriptionCollapsed && (
          <SimpleEditor
            identifier="description"
            content={description.text}
            isVisible={description.isVisible}
            style={description.style}
          />
        )}
      </Field>

      {/* Statistiques Section Collapsible */}
      <Field
        as="div"
        className={sectionContainerClasses}
      >
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setStatsCollapsed((prev) => !prev)}
        >
          <HeadlessLabel className="font-sans text-base font-medium text-white flex-1">
            {t("labels.stats")}
          </HeadlessLabel>
          <span
            className="ml-2 transition-transform"
            style={{
              transform: statsCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDownIcon className="h-5 w-5 text-neutral-400" />
          </span>
        </div>
        {!statsCollapsed && (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={localStats.map((_, index) => `stat-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 mt-3">
                  {localStats.map((localStat, index) => (
                    <SortableItem
                      key={`stat-${index}`}
                      id={`stat-${index}`}
                    >
                      <StatRowContent
                        stat={localStat}
                        index={index}
                        handleLocalLabelChange={handleLocalLabelChange}
                        handleLocalValueChange={handleLocalValueChange}
                        handleLocalStyleChange={handleLocalStyleChange}
                        handleSaveChanges={handleSaveChanges}
                        handleRemoveStat={handleRemoveStat}
                        debounceStyleUpdate={debounceStyleUpdate}
                      />
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleAddStat}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <FaPlus className="w-4 h-4" />
                {t("labels.add_stat")}
              </button>
            </div>
          </>
        )}
      </Field>

      {/* Bouton Ajouter au panier en bas, style identique à Overview */}
      {isAddingToCart && (
        <CartLoaderOverlay message={t("overview.adding_to_cart")} />
      )}
      <button
        onClick={handleAddToCart}
        disabled={isAddingToCart}
        className="w-full text-sm cursor-pointer flex justify-center items-center space-x-2 bg-orange-500 hover:opacity-75 text-white py-2 rounded-sm disabled:opacity-50 disabled:cursor-wait mt-8"
      >
        {isAddingToCart ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{t("overview.adding_to_cart")}</span>
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 1 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>{t("overview.add_to_cart")}</span>
          </>
        )}
      </button>
    </div>
  );
};

export default Labels;
