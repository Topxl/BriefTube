import { useEffect, type RefObject } from "react";

type Options = {
  ref: RefObject<Element | null>;
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  threshold?: number;
};

// Walks up the DOM until it finds an ancestor that actually scrolls.
// Needed when the sentinel lives inside a sheet/dialog/modal that has its
// own scroll container — using the viewport as the IntersectionObserver root
// would never trigger because the sentinel only ever scrolls inside the
// inner container, not the viewport.
function findScrollableParent(el: Element): Element | null {
  let parent: Element | null = el.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === "auto" || overflowY === "scroll";
    if (isScrollable && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export function useInfiniteScroll({
  ref,
  hasMore,
  loading = false,
  onLoadMore,
  threshold = 0.1,
}: Options) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;

    const root = findScrollableParent(el);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { root, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, hasMore, loading, onLoadMore, threshold]);
}
