import { describe, expect, it } from 'vitest';
import { SelectionOverlayHelper } from './selectionOverlay';

describe('SelectionOverlayHelper', () => {
    it('uses internal default fill opacity when not provided per call', () => {
        const helper = new SelectionOverlayHelper({ fillOpacity: 0.35 });
        const material = helper.createSelectionFillMaterial('#ff00ff');
        expect(material.opacity).toBeCloseTo(0.35);
        expect(material.transparent).toBe(true);
    });

    it('allows per-call opacity override', () => {
        const helper = new SelectionOverlayHelper({ fillOpacity: 0.35 });
        const material = helper.createSelectionFillMaterial('#ff00ff', 1);
        expect(material.opacity).toBe(1);
        expect(material.transparent).toBe(false);
    });
});
