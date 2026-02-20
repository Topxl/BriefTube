/**
 * Lucide React icons re-exported with suppressHydrationWarning.
 * This prevents Dark Reader (browser extension) from causing hydration
 * mismatches by injecting data-darkreader-inline-stroke attributes on SVGs.
 *
 * All app code should import icons from "@/lib/icons" instead of "lucide-react".
 */
import { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowLeft as _ArrowLeft,
  ArrowRight as _ArrowRight,
  ChevronLeftIcon as _ChevronLeftIcon,
  CircleCheckIcon as _CircleCheckIcon,
  InfoIcon as _InfoIcon,
  Loader2Icon as _Loader2Icon,
  MoreHorizontalIcon as _MoreHorizontalIcon,
  OctagonXIcon as _OctagonXIcon,
  TriangleAlertIcon as _TriangleAlertIcon,
  Check as _Check,
  CheckCircle as _CheckCircle,
  CheckCircle2 as _CheckCircle2,
  CheckCircle2Icon as _CheckCircle2Icon,
  CheckIcon as _CheckIcon,
  ChevronDown as _ChevronDown,
  ChevronDownIcon as _ChevronDownIcon,
  ChevronRight as _ChevronRight,
  ChevronRightIcon as _ChevronRightIcon,
  ChevronUpIcon as _ChevronUpIcon,
  CircleIcon as _CircleIcon,
  Copy as _Copy,
  CopyIcon as _CopyIcon,
  Download as _Download,
  ExternalLink as _ExternalLink,
  ExternalLinkIcon as _ExternalLinkIcon,
  Headphones as _Headphones,
  LayoutDashboard as _LayoutDashboard,
  ListFilter as _ListFilter,
  ListVideo as _ListVideo,
  Loader2 as _Loader2,
  LogOut as _LogOut,
  Mail as _Mail,
  Menu as _Menu,
  MinusIcon as _MinusIcon,
  Moon as _Moon,
  MoreHorizontal as _MoreHorizontal,
  PanelLeftIcon as _PanelLeftIcon,
  Pause as _Pause,
  Pencil as _Pencil,
  Play as _Play,
  PlayIcon as _PlayIcon,
  Plus as _Plus,
  Search as _Search,
  SearchIcon as _SearchIcon,
  Send as _Send,
  Share2 as _Share2,
  Star as _Star,
  Sun as _Sun,
  Trash2 as _Trash2,
  User as _User,
  Users as _Users,
  X as _X,
  XCircleIcon as _XCircleIcon,
  XIcon as _XIcon,
  Youtube as _Youtube,
} from "lucide-react";

export type { LucideIcon, LucideProps } from "lucide-react";

function wrap(Icon: LucideIcon): LucideIcon {
  const Wrapped = forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
    <Icon ref={ref} suppressHydrationWarning {...props} />
  ));
  Wrapped.displayName = (Icon as { displayName?: string }).displayName;
  return Wrapped as LucideIcon;
}

export const ArrowLeft = wrap(_ArrowLeft);
export const ArrowRight = wrap(_ArrowRight);
export const ChevronLeftIcon = wrap(_ChevronLeftIcon);
export const CircleCheckIcon = wrap(_CircleCheckIcon);
export const InfoIcon = wrap(_InfoIcon);
export const Loader2Icon = wrap(_Loader2Icon);
export const MoreHorizontalIcon = wrap(_MoreHorizontalIcon);
export const OctagonXIcon = wrap(_OctagonXIcon);
export const TriangleAlertIcon = wrap(_TriangleAlertIcon);
export const Check = wrap(_Check);
export const CheckCircle = wrap(_CheckCircle);
export const CheckCircle2 = wrap(_CheckCircle2);
export const CheckCircle2Icon = wrap(_CheckCircle2Icon);
export const CheckIcon = wrap(_CheckIcon);
export const ChevronDown = wrap(_ChevronDown);
export const ListFilter = wrap(_ListFilter);
export const ChevronDownIcon = wrap(_ChevronDownIcon);
export const ChevronRight = wrap(_ChevronRight);
export const ChevronRightIcon = wrap(_ChevronRightIcon);
export const ChevronUpIcon = wrap(_ChevronUpIcon);
export const CircleIcon = wrap(_CircleIcon);
export const Copy = wrap(_Copy);
export const CopyIcon = wrap(_CopyIcon);
export const Download = wrap(_Download);
export const ExternalLink = wrap(_ExternalLink);
export const ExternalLinkIcon = wrap(_ExternalLinkIcon);
export const Headphones = wrap(_Headphones);
export const LayoutDashboard = wrap(_LayoutDashboard);
export const ListVideo = wrap(_ListVideo);
export const Loader2 = wrap(_Loader2);
export const LogOut = wrap(_LogOut);
export const Mail = wrap(_Mail);
export const Menu = wrap(_Menu);
export const MinusIcon = wrap(_MinusIcon);
export const Moon = wrap(_Moon);
export const MoreHorizontal = wrap(_MoreHorizontal);
export const PanelLeftIcon = wrap(_PanelLeftIcon);
export const Pause = wrap(_Pause);
export const Pencil = wrap(_Pencil);
export const Play = wrap(_Play);
export const PlayIcon = wrap(_PlayIcon);
export const Plus = wrap(_Plus);
export const Search = wrap(_Search);
export const SearchIcon = wrap(_SearchIcon);
export const Send = wrap(_Send);
export const Share2 = wrap(_Share2);
export const Star = wrap(_Star);
export const Sun = wrap(_Sun);
export const Trash2 = wrap(_Trash2);
export const User = wrap(_User);
export const Users = wrap(_Users);
export const X = wrap(_X);
export const XCircleIcon = wrap(_XCircleIcon);
export const XIcon = wrap(_XIcon);
export const Youtube = wrap(_Youtube);
