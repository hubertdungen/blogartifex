import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from '../services/I18nService';

/**
 * ImageTools - Floating image editor shown over a selected image.
 *
 * The prebuilt CKEditor classic build has no image-resize UI. This React
 * overlay adds one without touching the (fragile) editor build:
 *  - a toolbar docked just above the selected image with size presets and
 *    object-fit modes;
 *  - drag handles at the four corners to resize the image by hand, like a
 *    design tool.
 *
 * All changes are written to the image's inline `style` in the editor model
 * (preserved by ckeditorExtensions), so they are undoable and render on
 * Blogger.
 */

const IMAGE_MODELS = ['imageBlock', 'imageInline'];

const getSelectedImageModel = (editor) => {
  const el = editor.model.document.selection.getSelectedElement();
  return el && IMAGE_MODELS.includes(el.name) ? el : null;
};

const getImageDom = (editor, modelImg) => {
  const viewEl = editor.editing.mapper.toViewElement(modelImg);
  if (!viewEl) return null;
  const dom = editor.editing.view.domConverter.mapViewToDom(viewEl);
  if (!dom) return null;
  return dom.tagName === 'IMG' ? dom : dom.querySelector('img');
};

// Update a single CSS declaration inside a style string.
const setStyleProp = (styleStr, prop, value) => {
  const decls = (styleStr || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(d => d.split(':')[0].trim().toLowerCase() !== prop.toLowerCase());
  if (value !== null && value !== undefined && value !== '') {
    decls.push(`${prop}:${value}`);
  }
  return decls.join(';') + (decls.length ? ';' : '');
};

const removeStyleProps = (styleStr, props) => {
  let out = styleStr || '';
  props.forEach(p => { out = setStyleProp(out, p, null); });
  return out;
};

function ImageTools({ editor }) {
  const [box, setBox] = useState(null); // {top,left,width,height} viewport coords
  const [barPos, setBarPos] = useState(null); // {top,left} viewport coords
  const stateRef = useRef({ modelImg: null, domImg: null });
  const dragRef = useRef(null);
  const barRef = useRef(null);

  // Place the toolbar above the image, centred on it but kept inside the
  // viewport; flip it below the image when there is no room above (small
  // screens, image at the top of the page).
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!box || !bar) { setBarPos(null); return; }
    const gap = 8;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { width: bw, height: bh } = bar.getBoundingClientRect();
    let left = box.left + box.width / 2 - bw / 2;
    left = Math.max(margin, Math.min(left, vw - bw - margin));
    let top = box.top - bh - gap;
    if (top < margin) top = box.top + box.height + gap;
    top = Math.max(margin, Math.min(top, vh - bh - margin));
    setBarPos(prev => (prev && prev.top === top && prev.left === left) ? prev : { top, left });
  }, [box]);

  const recompute = useCallback(() => {
    if (!editor || editor.state === 'destroyed') { setBox(null); return; }
    const modelImg = getSelectedImageModel(editor);
    if (!modelImg) { stateRef.current = {}; setBox(null); return; }
    const domImg = getImageDom(editor, modelImg);
    if (!domImg) { setBox(null); return; }
    stateRef.current = { modelImg, domImg };
    const r = domImg.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.state === 'destroyed') return undefined;
    const onChange = () => setTimeout(recompute, 0);
    const selection = editor.model.document.selection;
    selection.on('change:range', onChange);
    editor.model.document.on('change:data', onChange);
    editor.ui.on('update', onChange);
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      selection.off('change:range', onChange);
      editor.model.document.off('change:data', onChange);
      editor.ui.off('update', onChange);
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [editor, recompute]);

  // Layout can shift without any event we listen to (a banner appearing
  // above the editor, an image finishing loading). While an image is
  // selected, follow it every frame and only re-render when it moved.
  const selected = !!box;
  useEffect(() => {
    if (!selected) return undefined;
    let frame;
    const follow = () => {
      const { domImg } = stateRef.current;
      if (domImg && domImg.isConnected && !dragRef.current) {
        const r = domImg.getBoundingClientRect();
        setBox(prev => (prev && prev.top === r.top && prev.left === r.left &&
          prev.width === r.width && prev.height === r.height)
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height });
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [selected]);

  const applyStyle = (mutate) => {
    const { modelImg } = stateRef.current;
    if (!modelImg) return;
    editor.model.change(writer => {
      const current = modelImg.getAttribute('style') || '';
      const next = mutate(current);
      if (next && next.trim()) writer.setAttribute('style', next, modelImg);
      else writer.removeAttribute('style', modelImg);
    });
    setTimeout(recompute, 0);
    editor.editing.view.focus();
  };

  const setWidthPercent = (pct) => applyStyle(s => {
    let out = removeStyleProps(s, ['width', 'height', 'object-fit']);
    if (pct) out = setStyleProp(out, 'width', pct);
    return out;
  });

  const setFit = (objectFit) => applyStyle(s => {
    let out = removeStyleProps(s, ['width', 'height', 'object-fit']);
    if (objectFit) {
      out = setStyleProp(out, 'width', '100%');
      out = setStyleProp(out, 'height', '360px');
      out = setStyleProp(out, 'object-fit', objectFit);
    }
    return out;
  });

  // ---- Manual drag-resize ----
  const onHandleDown = (corner) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { domImg } = stateRef.current;
    if (!domImg) return;
    const editable = editor.ui.view.editable.element;
    const maxW = editable ? editable.clientWidth : window.innerWidth;
    dragRef.current = {
      corner,
      startX: e.clientX,
      startW: domImg.getBoundingClientRect().width,
      maxW,
      left: corner.includes('l')
    };
    try { e.target.setPointerCapture(e.pointerId); } catch { /* noop */ }
    window.addEventListener('pointermove', onHandleMove);
    window.addEventListener('pointerup', onHandleUp);
  };

  const onHandleMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const { domImg } = stateRef.current;
    if (!domImg) return;
    const dx = e.clientX - d.startX;
    let newW = d.left ? d.startW - dx : d.startW + dx;
    newW = Math.max(40, Math.min(newW, d.maxW));
    // Live preview directly on the DOM node.
    domImg.style.width = `${Math.round(newW)}px`;
    domImg.style.height = 'auto';
    domImg.style.objectFit = '';
    const r = domImg.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  const onHandleUp = () => {
    const d = dragRef.current;
    const { domImg } = stateRef.current;
    window.removeEventListener('pointermove', onHandleMove);
    window.removeEventListener('pointerup', onHandleUp);
    dragRef.current = null;
    if (!d || !domImg) return;
    const finalW = Math.round(domImg.getBoundingClientRect().width);
    // Commit to the model so it persists, round-trips and is undoable.
    applyStyle(s => setStyleProp(removeStyleProps(s, ['height', 'object-fit']), 'width', `${finalW}px`));
  };

  if (!box) return null;

  const sizes = [
    { id: 'original', pct: '' },
    { id: 'small', pct: '25%' },
    { id: 'medium', pct: '50%' },
    { id: 'large', pct: '75%' },
    { id: 'full', pct: '100%' }
  ];
  const fits = [
    { id: 'fit', v: 'contain' },
    { id: 'fill', v: 'cover' },
    { id: 'stretch', v: 'fill' }
  ];

  const handle = (corner, cursor) => (
    <span
      className={`image-tools-handle h-${corner}`}
      style={{ cursor }}
      onPointerDown={onHandleDown(corner)}
      role="presentation"
    />
  );

  return (
    <>
      <div className="image-tools-overlay" style={{ top: box.top, left: box.left, width: box.width, height: box.height }}>
        {handle('tl', 'nwse-resize')}
        {handle('tr', 'nesw-resize')}
        {handle('bl', 'nesw-resize')}
        {handle('br', 'nwse-resize')}
      </div>
      <div
        ref={barRef}
        className="image-tools-bar"
        style={barPos ? { top: barPos.top, left: barPos.left } : { visibility: 'hidden' }}
        onMouseDown={(e) => e.preventDefault()}
        role="toolbar"
        aria-label={t('editor.imageFormat.title')}
      >
        <span className="image-tools-group-label">{t('editor.imageSize.label')}</span>
        {sizes.map(s => (
          <button key={s.id} type="button" onClick={() => setWidthPercent(s.pct)}>
            {t(`editor.imageSize.${s.id}`)}
          </button>
        ))}
        <span className="image-tools-sep" />
        {fits.map(f => (
          <button key={f.id} type="button" onClick={() => setFit(f.v)}>
            {t(`editor.imageFormat.${f.id}`)}
          </button>
        ))}
      </div>
    </>
  );
}

export default ImageTools;
