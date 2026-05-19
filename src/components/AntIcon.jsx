// =============================================================================
// AntIcon — minimal SVG renderer for @ant-design/icons-svg path data.
// =============================================================================
//
// Why this exists:
//
//   @ant-design/icons publishes per-icon components, but each one
//   imports a heavy `AntdIcon` wrapper that in turn pulls in:
//     - @ant-design/colors (palette generator)
//     - context providers (Context.js, twoTonePrimaryColor.js)
//     - the full IconBase abstraction (forwardRef, clsx, etc.)
//
//   For a project that uses ~37 distinct icons across the dashboard,
//   each Vite chunk for a single icon was coming out to 50-80 KB where
//   only ~1 KB was actual icon path data — verified by the Lighthouse
//   audit (Lighthouse_Reports/lighthouse-sensor-measurements.json
//   flagged 163 KB of wasted JS on the default page; the top three
//   chunks were per-icon).
//
//   This component renders raw `@ant-design/icons-svg/lib/asn/<Name>`
//   path data directly into an SVG element. Those data files are
//   ~600 bytes each (just the JSON shape: viewBox + path d attrs).
//   After Vite minifies, each per-icon chunk drops from ~70 KB to
//   ~1 KB. Across the dashboard that's a meaningful TTI win.
//
// Usage at call sites:
//
//   // OLD (heavy):
//   //   import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
//   //   <ClockCircleOutlined style={{ color: 'var(--blue)' }} />
//
//   // NEW (light):
//   import ClockCircleOutlined from '@ant-design/icons-svg/lib/asn/ClockCircleOutlined';
//   import AntIcon from 'components/AntIcon';
//   <AntIcon icon={ClockCircleOutlined} style={{ color: 'var(--blue)' }} />
//
// All other props (style, className, onClick, aria-label, ref) flow
// through to the root <svg> exactly as they would on the original
// @ant-design/icons component.

import { forwardRef, memo, createElement } from 'react';

// Recursively render the asn data tree as native SVG elements. The
// shape is a small DSL the @ant-design/icons-svg package emits:
//
//   { tag: 'svg' | 'path' | 'g' | ..., attrs: {...}, children?: [...] }
//
// React.createElement handles SVG tags directly when the tag string
// matches a valid SVG element name. No JSX needed.
function renderNode(node, key) {
  return createElement(
    node.tag,
    { ...node.attrs, key },
    node.children ? node.children.map(renderNode) : undefined
  );
}

// memo + forwardRef matches the API the original @ant-design/icons
// components shipped, so consumers can pass a ref or compare props
// the same way they always did. memo is worth keeping because icons
// re-render on every parent update otherwise — there are dozens on
// the dashboard and the toolbar fidgets frequently.
const AntIcon = memo(
  forwardRef(function AntIcon({ icon, style, className, onClick, ...rest }, ref) {
    // Defensive — if the caller forgets to pass `icon` (or the asn
    // import resolves to undefined for any reason) render nothing
    // rather than crash. Matches @ant-design/icons' own behavior on
    // a missing icon prop.
    if (!icon?.icon) return null;
    const { tag, attrs, children } = icon.icon;
    return createElement(
      tag,
      {
        // Defaults from @ant-design/icons' AntdIcon wrapper:
        //   width/height: '1em'      — icons scale with surrounding text
        //   fill: 'currentColor'     — picks up the parent's `color`
        //                              so `style={{ color: '...' }}`
        //                              flows naturally to the SVG fill
        //   focusable: 'false'       — IE/Edge legacy compat; never
        //                              part of the tab order unless an
        //                              ARIA attribute opts in
        ...attrs,
        width: '1em',
        height: '1em',
        fill: 'currentColor',
        focusable: 'false',
        ...rest,
        style,
        className,
        onClick,
        ref
      },
      children ? children.map((c, i) => renderNode(c, i)) : undefined
    );
  })
);

export default AntIcon;
