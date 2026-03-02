// ============================================
// Wall Detection — Ray casting for proximity aura
// Line-segment vs rectangle intersection
// ============================================

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Point {
    x: number;
    y: number;
}

/**
 * Check if a line segment (p1→p2) intersects a rectangle.
 * Uses the Cohen-Sutherland-like approach: test all 4 edges.
 */
export function lineIntersectsRect(p1: Point, p2: Point, rect: Rect): boolean {
    // Test against all 4 edges of the rectangle
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;

    // If both points are inside the rect, no wall between them (they're in the same room)
    if (isPointInRect(p1, rect) && isPointInRect(p2, rect)) return false;

    // Test each edge
    return (
        segmentsIntersect(p1, p2, { x: left, y: top }, { x: right, y: top }) ||        // top edge
        segmentsIntersect(p1, p2, { x: right, y: top }, { x: right, y: bottom }) ||     // right edge
        segmentsIntersect(p1, p2, { x: left, y: bottom }, { x: right, y: bottom }) ||   // bottom edge
        segmentsIntersect(p1, p2, { x: left, y: top }, { x: left, y: bottom })          // left edge
    );
}

/**
 * Check if two line segments intersect.
 * Uses cross-product orientation method.
 */
function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    const d1 = direction(b1, b2, a1);
    const d2 = direction(b1, b2, a2);
    const d3 = direction(a1, a2, b1);
    const d4 = direction(a1, a2, b2);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }

    if (d1 === 0 && onSegment(b1, b2, a1)) return true;
    if (d2 === 0 && onSegment(b1, b2, a2)) return true;
    if (d3 === 0 && onSegment(a1, a2, b1)) return true;
    if (d4 === 0 && onSegment(a1, a2, b2)) return true;

    return false;
}

function direction(pi: Point, pj: Point, pk: Point): number {
    return (pk.x - pi.x) * (pj.y - pi.y) - (pj.x - pi.x) * (pk.y - pi.y);
}

function onSegment(pi: Point, pj: Point, pk: Point): boolean {
    return (
        Math.min(pi.x, pj.x) <= pk.x && pk.x <= Math.max(pi.x, pj.x) &&
        Math.min(pi.y, pj.y) <= pk.y && pk.y <= Math.max(pi.y, pj.y)
    );
}

/**
 * Check if a point is inside a rectangle.
 */
export function isPointInRect(point: Point, rect: Rect): boolean {
    return (
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
    );
}

/**
 * Check if a line between two points is blocked by any room wall.
 * Returns true if blocked (a room wall is between the two points).
 */
export function isBlockedByWall(p1: Point, p2: Point, rooms: Rect[]): boolean {
    for (const room of rooms) {
        if (lineIntersectsRect(p1, p2, room)) {
            return true;
        }
    }
    return false;
}

/**
 * Calculate Euclidean distance between two points.
 */
export function distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
