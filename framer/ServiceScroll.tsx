// Service Scroll: a centre-snapping service index.
// On the site, the page scrollbar travels through the section and moves the
// stack. The frame stays pinned until the last service, then the page continues.
// The service in the middle is shown in colour. Its number sits on the left,
// its name on the right, and its description and tags along the lower left.
// A Lottie replaces that service's image. It stays on the first frame until
// the service is the one in the centre, then plays. Leaving the centre parks
// it on the first frame again.
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import lottie from "lottie-web"
import { DotLottie } from "@lottiefiles/dotlottie-web"
import {
    startTransition,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
} from "react"

interface ProjectImage {
    src: string
    srcSet?: string
    alt?: string
}

interface Project {
    title: string
    description: string
    tags: string
    image?: ProjectImage
    lottie?: string
    ratio: string
    size: string
    link?: string
}

interface ProjectScrollProps {
    projects: Project[]
    imageWidth: number
    gap: number
    grayscale: boolean
    imageDim: number
    showList: boolean
    showDetails: boolean
    marker: "corners" | "brackets" | "none"
    markerColor: string
    markerSize: number
    markerWeight: number
    markerInset: number
    font: CSSProperties
    textColor: string
    textDim: number
    backgroundColor: string
    tagColor: string
    padding: number
    pageScroll: boolean
    scrollDistance: number
    captureScroll: boolean
    speed: number
    smoothness: number
    style?: CSSProperties
}

const RATIOS: Record<string, number> = {
    "1:1": 1,
    "4:5": 4 / 5,
    "3:4": 3 / 4,
    "2:3": 2 / 3,
    "4:3": 4 / 3,
    "3:2": 3 / 2,
    "16:9": 16 / 9,
}

const SIZES: Record<string, number> = { S: 0.68, M: 0.85, L: 1 }

const FALLBACK_IMAGES: ProjectImage[] = [
    {
        src: "https://framerusercontent.com/images/fnzonyAbobZ7d9k3tdvv2eBVDA.jpg",
        alt: "Warm minimal living room",
    },
    {
        src: "https://framerusercontent.com/images/dMwHsImPwXmUdSRWz47Jy4irpY.jpg",
        alt: "Alphabet type specimen poster",
    },
    {
        src: "https://framerusercontent.com/images/uReb9e0PRoHXkSEdd0tBuxvI.jpg",
        alt: "Black concept car with red accents",
    },
    {
        src: "https://framerusercontent.com/images/OeZx4A36M6ZvwFIoVi0IEpRyE.jpg",
        alt: "White skincare tube on glass",
    },
    {
        src: "https://framerusercontent.com/images/q56Zsrnkpkp4i2BSc7AnvHgqDwo.jpg",
        alt: "Black and silver turntable",
    },
]

const LIVING_ROOM = FALLBACK_IMAGES[0]
const TURNTABLE = FALLBACK_IMAGES[4]

// Scroll order. Each title is unique.
const DEFAULT_PROJECTS: Project[] = [
    {
        title: "Auditoría y migración",
        description:
            "Abosrdo desde el análisis del negocio y la calidad de los datos hasta la integración con sus sistemas de gestión, asegurando una correcta sincronización.",
        tags: "Catálogo y datos, Migración, Integración, Automatización, Shopify, PrestaShop",
        image: LIVING_ROOM,
        ratio: "1:1",
        size: "L",
    },
    {
        title: "Diseño",
        description:
            "Adapto la identidad de marca a una experiencia digital coherente, accesible y responsive, personalizando temas y componentes según las necesidades del proyecto.",
        tags: "UI, Branding, Responsible, Usabilidad, Accesibilidad, HTML, CSS",
        image: TURNTABLE,
        ratio: "1:1",
        size: "L",
    },
    {
        title: "Funcionalidad y escalabilidad",
        description:
            "Organizo la información y desarrollo soluciones que equilibran buscando un equilibrio entre experiencia de usuario, viabilidad técnica y coste.",
        tags: "Arquitectura de la información, Colecciones inteligentes, Apps, Integraciones",
        image: TURNTABLE,
        ratio: "1:1",
        size: "L",
    },
    {
        title: "Mantenimiento y mejora continua",
        description:
            "Doy continuidad a los proyectos tras su lanzamiento, resolviendo incidencias, adaptando la tienda a nuevas campañas e identificando oportunidades de mejora.",
        tags: "Resolución de problemas, QA, Banners, Campañas, Optimización",
        image: TURNTABLE,
        ratio: "1:1",
        size: "L",
    },
    {
        title: "Inteligencia Artificial",
        description:
            "En paralelo, exploro cómo la IA y la automatización pueden ayudar a detectar errores, simplificar tareas y mejorar los procesos internos.",
        tags: "Cursor, Automatización, Control de errores",
        image: TURNTABLE,
        ratio: "1:1",
        size: "L",
    },
]

const BASE_CSS = `
.fx-ps-root{outline:none}
.fx-ps-root:focus-visible{outline:2px solid currentColor;outline-offset:-2px}
.fx-ps-row{opacity:var(--ps-text-dim);cursor:pointer}
.fx-ps-row:hover{opacity:var(--ps-text-hover)}
.fx-ps-row[data-active="true"]{opacity:1;font-weight:700}
.fx-ps-item{opacity:var(--ps-img-dim);filter:var(--ps-img-filter)}
.fx-ps-item[data-active="true"]{opacity:1;filter:none}
.fx-ps-frame{width:100%;height:100%;overflow:hidden;border-radius:5%;transform:scale(0.85);transform-origin:center center}
.fx-ps-item[data-active="true"] .fx-ps-frame{transform:scale(1.2)}
.fx-ps-lottie{width:100%;height:100%}
.fx-ps-lottie svg,.fx-ps-lottie canvas{width:100%!important;height:100%!important;display:block}
`

// Transitions are left out on the canvas and in exports, and switched off
// for visitors who prefer reduced motion
const MOTION_CSS = `
.fx-ps-row{transition:opacity .35s ease}
.fx-ps-item{transition:opacity .5s ease,filter .5s ease}
.fx-ps-frame{transition:transform .6s cubic-bezier(.22,1,.36,1)}
.fx-ps-fade{transition:opacity .6s ease}
.fx-ps-marker{transition:width .6s cubic-bezier(.22,1,.36,1),height .6s cubic-bezier(.22,1,.36,1)}
@media (prefers-reduced-motion: reduce){.fx-ps-row,.fx-ps-item,.fx-ps-frame,.fx-ps-fade,.fx-ps-marker{transition:none}}
`

const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect

function mod(value: number, total: number): number {
    return ((value % total) + total) % total
}

function findScrollParent(element: HTMLElement): HTMLElement | Window {
    let parent = element.parentElement
    while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
    ) {
        const { overflowY } = getComputedStyle(parent)
        if (
            (overflowY === "auto" || overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight + 2
        ) {
            return parent
        }
        parent = parent.parentElement
    }
    return window
}

// Wraps a value into [-total / 2, total / 2)
function wrap(value: number, total: number): number {
    return mod(value + total / 2, total) - total / 2
}

function toPx(value: unknown, fallback: number): number {
    const parsed = typeof value === "number" ? value : parseFloat(String(value))
    return Number.isFinite(parsed) ? parsed : fallback
}

function lineHeightPx(value: unknown, fontSize: number): number {
    if (typeof value === "number") return value * fontSize
    const text = String(value ?? "")
    const parsed = parseFloat(text)
    if (!Number.isFinite(parsed)) return fontSize * 1.2
    if (text.endsWith("px")) return parsed
    if (text.endsWith("%")) return (parsed / 100) * fontSize
    return parsed * fontSize
}

function fileUrl(value: unknown): string {
    if (typeof value === "string") return value.trim()
    if (!value || typeof value !== "object") return ""
    const record = value as Record<string, unknown>
    for (const key of ["src", "url", "href"]) {
        const candidate = record[key]
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim()
        }
    }
    return ""
}

function isDotLottie(src: string): boolean {
    const path = src.split("?")[0].split("#")[0].toLowerCase()
    return path.endsWith(".lottie")
}

interface Playback {
    playFromStart: () => void
    holdFirstFrame: () => void
    destroy: () => void
}

function applyPlayback(playback: Playback, playing: boolean) {
    if (playing) playback.playFromStart()
    else playback.holdFirstFrame()
}

// Draws a Lottie in the image frame. JSON is real SVG. .lottie uses the
// dotLottie player. Either way the clip stays on its first frame until
// `playing` is true, and returns there when the service leaves the centre.
function LottieFrame({
    src,
    playing,
    onError,
}: {
    src: string
    playing: boolean
    onError: () => void
}) {
    const hostRef = useRef<HTMLDivElement>(null)
    const playingRef = useRef(playing)
    const onErrorRef = useRef(onError)
    const playbackRef = useRef<Playback | null>(null)
    playingRef.current = playing
    onErrorRef.current = onError

    useEffect(() => {
        const host = hostRef.current
        if (!host || !src) return
        let cancelled = false

        const fail = () => {
            if (!cancelled) onErrorRef.current()
        }

        const connect = (playback: Playback) => {
            if (cancelled) {
                playback.destroy()
                return
            }
            playbackRef.current = playback
            applyPlayback(playback, playingRef.current)
        }

        if (isDotLottie(src)) {
            const canvas = document.createElement("canvas")
            canvas.style.cssText = "width:100%;height:100%;display:block"
            host.replaceChildren(canvas)
            let dot: DotLottie
            try {
                dot = new DotLottie({
                    canvas,
                    src,
                    loop: true,
                    autoplay: false,
                    layout: { fit: "contain", align: [0.5, 0.5] },
                    renderConfig: { autoResize: true },
                })
            } catch {
                fail()
                return
            }
            const onLoad = () => {
                connect({
                    playFromStart() {
                        dot.setFrame(0)
                        dot.play()
                    },
                    holdFirstFrame() {
                        dot.pause()
                        dot.setFrame(0)
                    },
                    destroy() {
                        dot.removeEventListener("load", onLoad)
                        dot.removeEventListener("loadError", fail)
                        dot.destroy()
                    },
                })
            }
            dot.addEventListener("load", onLoad)
            dot.addEventListener("loadError", fail)
            return () => {
                cancelled = true
                const playback = playbackRef.current
                playbackRef.current = null
                if (playback) playback.destroy()
                else {
                    dot.removeEventListener("load", onLoad)
                    dot.removeEventListener("loadError", fail)
                    dot.destroy()
                }
                host.replaceChildren()
            }
        }

        let animation: ReturnType<typeof lottie.loadAnimation>
        try {
            animation = lottie.loadAnimation({
                container: host,
                renderer: "svg",
                loop: true,
                autoplay: false,
                path: src,
                rendererSettings: {
                    preserveAspectRatio: "xMidYMid meet",
                },
            })
        } catch {
            fail()
            return
        }
        const onReady = () => {
            const first = Number.isFinite(animation.firstFrame)
                ? animation.firstFrame
                : 0
            connect({
                playFromStart() {
                    animation.goToAndPlay(first, true)
                },
                holdFirstFrame() {
                    animation.goToAndStop(first, true)
                },
                destroy() {
                    animation.destroy()
                },
            })
        }
        animation.addEventListener("DOMLoaded", onReady)
        animation.addEventListener("data_failed", fail)
        return () => {
            cancelled = true
            animation.removeEventListener("DOMLoaded", onReady)
            animation.removeEventListener("data_failed", fail)
            playbackRef.current = null
            animation.destroy()
            host.replaceChildren()
        }
    }, [src])

    useEffect(() => {
        const playback = playbackRef.current
        if (!playback) return
        applyPlayback(playback, playing)
    }, [playing])

    return <div ref={hostRef} className="fx-ps-lottie" aria-hidden="true" />
}

function FrameVisual({
    lottieSrc,
    image,
    width,
    playing,
}: {
    lottieSrc: string
    image: ProjectImage
    width: number
    playing: boolean
}) {
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        setFailed(false)
    }, [lottieSrc])

    if (lottieSrc && !failed) {
        return (
            <LottieFrame
                src={lottieSrc}
                playing={playing}
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={`${width}px`}
            alt={image.alt ?? ""}
            draggable={false}
            style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
            }}
        />
    )
}

interface Layout {
    count: number
    sizes: { width: number; height: number }[]
    centers: number[]
    period: number
    total: number
    slots: { project: number; base: number }[]
    maxWidth: number
}

function buildLayout(
    projects: Project[],
    imageWidth: number,
    gap: number,
    scale: number,
    viewportHeight: number
): Layout {
    const count = projects.length
    const sizes = projects.map((project) => {
        const width = Math.round(
            imageWidth * scale * (SIZES[project.size] ?? 1)
        )
        const height = Math.round(width / (RATIOS[project.ratio] ?? 1))
        return { width, height }
    })
    const centers: number[] = []
    let cursor = 0
    sizes.forEach((size, index) => {
        if (index > 0)
            cursor += sizes[index - 1].height / 2 + gap + size.height / 2
        centers.push(cursor)
    })
    const period = sizes.reduce((sum, size) => sum + size.height + gap, 0)
    const maxHeight = sizes.reduce((max, size) => Math.max(max, size.height), 0)
    const maxWidth = sizes.reduce((max, size) => Math.max(max, size.width), 0)
    // Enough copies that a wrapping item is always outside the viewport
    const copies =
        period > 0
            ? Math.max(1, Math.ceil((viewportHeight + maxHeight * 2) / period))
            : 1
    const slots: Layout["slots"] = []
    for (let copy = 0; copy < copies; copy++) {
        for (let index = 0; index < count; index++) {
            slots.push({ project: index, base: copy * period + centers[index] })
        }
    }
    return {
        count,
        sizes,
        centers,
        period,
        total: copies * period,
        slots,
        maxWidth,
    }
}

// Centre of the n-th item on the endless track (n may be any integer)
function centerAt(layout: Layout, n: number): number {
    const { count, centers, period } = layout
    return centers[mod(n, count)] + Math.floor(n / count) * period
}

function nearestItem(layout: Layout, position: number): number {
    const { count, period } = layout
    const start = Math.floor(position / period) * count
    let best = start
    let bestDistance = Infinity
    for (let n = start; n <= start + count; n++) {
        const distance = Math.abs(centerAt(layout, n) - position)
        if (distance < bestDistance) {
            bestDistance = distance
            best = n
        }
    }
    return best
}

// Position expressed as a fractional project index in [0, count)
function floatIndex(layout: Layout, position: number): number {
    const { count, centers, period } = layout
    const local = mod(position, period)
    let index = 0
    while (index < count - 1 && local >= centers[index + 1]) index++
    const from = centers[index]
    const to = index === count - 1 ? period : centers[index + 1]
    return index + (local - from) / (to - from)
}

function slotTransform(layout: Layout, slot: number, position: number): string {
    const y = wrap(layout.slots[slot].base - position, layout.total)
    return `translate3d(-50%, calc(-50% + ${y.toFixed(2)}px), 0)`
}

function rowTransform(row: number, index: number, lineHeight: number): string {
    const y = (row - index) * lineHeight
    return `translate3d(0, calc(-50% + ${y.toFixed(2)}px), 0)`
}

function activeSlot(layout: Layout, position: number): number {
    let best = 0
    let bestDistance = Infinity
    layout.slots.forEach((slot, index) => {
        const distance = Math.abs(wrap(slot.base - position, layout.total))
        if (distance < bestDistance) {
            bestDistance = distance
            best = index
        }
    })
    return best
}

const swapVariants = {
    enter: (direction: number) => ({ y: direction >= 0 ? "100%" : "-100%" }),
    center: { y: "0%" },
    exit: (direction: number) => ({ y: direction >= 0 ? "-100%" : "100%" }),
}

function SwapText({ text, direction }: { text: string; direction: number }) {
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    if (isStatic) {
        return <span style={{ whiteSpace: "nowrap" }}>{text || "\u00A0"}</span>
    }
    return (
        <span
            style={{
                position: "relative",
                display: "inline-block",
                overflow: "hidden",
                verticalAlign: "top",
                whiteSpace: "nowrap",
            }}
        >
            <AnimatePresence
                initial={false}
                mode="popLayout"
                custom={direction}
            >
                <motion.span
                    key={text}
                    custom={direction}
                    variants={swapVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={
                        reducedMotion
                            ? { duration: 0 }
                            : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
                    }
                    style={{ display: "block" }}
                >
                    {text || " "}
                </motion.span>
            </AnimatePresence>
        </span>
    )
}

function parseTags(value: string | undefined): string[] {
    if (!value) return []
    return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
}

function ServiceCopy({
    project,
    tagColor,
}: {
    project: Project
    tagColor: string
}) {
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const tags = parseTags(project.tags)
    const body = (
        <>
            <p
                style={{
                    margin: 0,
                    whiteSpace: "normal",
                    lineHeight: 1.45,
                }}
            >
                {project.description}
            </p>
            {tags.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 16,
                    }}
                >
                    {tags.map((tag, index) => (
                        <span
                            key={`${tag}-${index}`}
                            style={{
                                display: "inline-block",
                                backgroundColor: tagColor,
                                color: "#3D2925",
                                padding: "6px 10px",
                                borderRadius: 4,
                                lineHeight: 1.2,
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </>
    )
    if (isStatic || reducedMotion) return <div>{body}</div>
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={`${project.title}-${project.description}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
                {body}
            </motion.div>
        </AnimatePresence>
    )
}

// A frame that resizes to hug the active image: four corner marks, or a
// pair of square brackets when the vertical strokes run the full height
function Marker({
    width,
    height,
    color,
    size,
    weight,
    brackets,
}: {
    width: number
    height: number
    color: string
    size: number
    weight: number
    brackets: boolean
}) {
    const stroke = `${weight}px solid ${color}`
    const corners = [
        { top: 0, left: 0, borderTop: stroke, borderLeft: stroke },
        { top: 0, right: 0, borderTop: stroke, borderRight: stroke },
        { bottom: 0, left: 0, borderBottom: stroke, borderLeft: stroke },
        { bottom: 0, right: 0, borderBottom: stroke, borderRight: stroke },
    ]
    return (
        <div
            aria-hidden="true"
            className="fx-ps-marker"
            style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width,
                height,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
            }}
        >
            {corners.map((corner, index) => (
                <div
                    key={index}
                    style={{
                        position: "absolute",
                        boxSizing: "border-box",
                        width: size,
                        height: brackets ? "50%" : size,
                        ...corner,
                    }}
                />
            ))}
        </div>
    )
}

/**
 * Service Scroll
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 */
export default function ProjectScroll(props: ProjectScrollProps) {
    const {
        imageWidth = 200,
        gap = 36,
        grayscale = true,
        imageDim = 1,
        showList = true,
        showDetails = true,
        marker = "none",
        markerColor = "#000000",
        markerSize = 16,
        markerWeight = 2,
        markerInset = 14,
        font,
        textColor = "#000000",
        textDim = 0.6,
        backgroundColor = "#FFFFFF",
        tagColor = "#B8AFA9",
        padding = 36,
        pageScroll = true,
        scrollDistance = 60,
        captureScroll = true,
        speed = 1,
        smoothness = 5,
    } = props
    const projects =
        props.projects && props.projects.length > 0
            ? props.projects
            : DEFAULT_PROJECTS

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const trackRef = useRef<HTMLDivElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const slotRefs = useRef<(HTMLAnchorElement | null)[]>([])
    const rowRefs = useRef<(HTMLDivElement | null)[]>([])

    const [viewport, setViewport] = useState(() => ({
        width: 1200,
        height: typeof window !== "undefined" ? window.innerHeight : 900,
    }))
    const [ready, setReady] = useState(false)
    const [active, setActive] = useState({ slot: 0, direction: 1 })

    const motionState = useRef({
        position: 0,
        target: 0,
        frame: 0,
        lastTime: 0,
        snapTimer: 0,
        slot: 0,
        dragEndedAt: -1000,
    })
    const drag = useRef({
        id: -1,
        startY: 0,
        lastY: 0,
        lastTime: 0,
        velocity: 0,
        moved: false,
    })

    const pageLinked = pageScroll && !isStatic
    const compact = viewport.width < 640
    const scale = compact ? 0.72 : 1

    const fontSize = toPx(font?.fontSize, 13)
    const lineHeight = lineHeightPx(font?.lineHeight, fontSize)

    const layout = useMemo(
        () => buildLayout(projects, imageWidth, gap, scale, viewport.height),
        [projects, imageWidth, gap, scale, viewport.height]
    )
    const layoutRef = useRef(layout)
    layoutRef.current = layout
    const lineHeightRef = useRef(lineHeight)
    lineHeightRef.current = lineHeight

    const count = layout.count
    // Room for every title above and below the centred one, so none are clipped.
    const listRows = Math.max(count * 2 - 1, 1)

    const apply = useCallback(() => {
        const state = motionState.current
        const current = layoutRef.current
        for (let index = 0; index < current.slots.length; index++) {
            const element = slotRefs.current[index]
            if (element) {
                element.style.transform = slotTransform(
                    current,
                    index,
                    state.position
                )
            }
        }
        const fractional = floatIndex(current, state.position)
        for (let row = 0; row < current.count; row++) {
            const element = rowRefs.current[row]
            if (element) {
                element.style.transform = rowTransform(
                    row,
                    fractional,
                    lineHeightRef.current
                )
            }
        }
        const slot = activeSlot(current, state.position)
        if (slot !== state.slot) {
            state.slot = slot
            const direction = state.target >= state.position ? 1 : -1
            startTransition(() => setActive({ slot, direction }))
        }
    }, [])

    const tick = useCallback(
        (now: number) => {
            const state = motionState.current
            const delta = Math.min(0.05, (now - state.lastTime) / 1000)
            state.lastTime = now
            const distance = state.target - state.position
            if (Math.abs(distance) < 0.05) {
                state.position = state.target
                state.frame = 0
                apply()
                return
            }
            const stiffness = reducedMotion ? 60 : 14 - smoothness
            state.position += distance * (1 - Math.exp(-delta * stiffness))
            apply()
            state.frame = requestAnimationFrame(tick)
        },
        [apply, smoothness, reducedMotion]
    )

    const run = useCallback(() => {
        const state = motionState.current
        if (state.frame || typeof window === "undefined") return
        state.lastTime = performance.now()
        state.frame = requestAnimationFrame(tick)
    }, [tick])

    const snap = useCallback(() => {
        const state = motionState.current
        const current = layoutRef.current
        state.target = centerAt(current, nearestItem(current, state.target))
        run()
    }, [run])

    const scheduleSnap = useCallback(
        (delay: number) => {
            const state = motionState.current
            window.clearTimeout(state.snapTimer)
            state.snapTimer = window.setTimeout(snap, delay)
        },
        [snap]
    )

    const step = useCallback(
        (amount: number) => {
            const state = motionState.current
            const current = layoutRef.current
            window.clearTimeout(state.snapTimer)
            state.target = centerAt(
                current,
                nearestItem(current, state.target) + amount
            )
            run()
        },
        [run]
    )

    // Measure the component itself to pick the layout and the number of copies
    useIsomorphicLayoutEffect(() => {
        const element = rootRef.current
        if (!element) return
        const measure = () => {
            const width = Math.round(element.clientWidth)
            const height = Math.round(element.clientHeight)
            if (!width || !height) return
            setViewport((previous) =>
                previous.width === width && previous.height === height
                    ? previous
                    : { width, height }
            )
        }
        measure()
        setReady(true)
        if (typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => startTransition(measure))
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    // Keep the current project centred when the layout changes.
    // Page scroll owns the position while the section is linked to the scrollbar.
    useIsomorphicLayoutEffect(() => {
        if (pageLinked) return
        const state = motionState.current
        const slot = Math.min(state.slot, layout.slots.length - 1)
        state.position = state.target = layout.slots[slot]?.base ?? 0
    }, [layout, pageLinked])

    // A render writes the transforms it was computed with; bring them back
    // to the live position before the browser paints
    useIsomorphicLayoutEffect(() => {
        apply()
    })

    useEffect(() => {
        const element = rootRef.current
        if (!element || isStatic || pageScroll || !captureScroll) return

        // Framer scrolls from a parent listener. Capturing on the window
        // runs first, so the stack takes the vertical gesture instead of the page.
        const onWheel = (event: WheelEvent) => {
            if (event.ctrlKey) return
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

            const rect = element.getBoundingClientRect()
            const over =
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom
            const covers =
                rect.height > 0 &&
                rect.top <= 4 &&
                rect.bottom >= window.innerHeight - 4
            const inside = event.composedPath().includes(element)
            if (!over && !covers && !inside) return

            if (event.cancelable) event.preventDefault()
            event.stopPropagation()

            let delta = event.deltaY
            if (event.deltaMode === 1) delta *= 16
            else if (event.deltaMode === 2) delta *= window.innerHeight
            motionState.current.target += delta * speed
            run()
            scheduleSnap(reducedMotion ? 0 : 140)
        }

        window.addEventListener("wheel", onWheel, {
            passive: false,
            capture: true,
        })
        return () => {
            window.removeEventListener("wheel", onWheel, { capture: true })
        }
    }, [
        isStatic,
        pageScroll,
        captureScroll,
        speed,
        reducedMotion,
        run,
        scheduleSnap,
    ])

    const scrollTrackTo = useCallback(
        (progress: number) => {
            const track = trackRef.current
            if (!track) return
            const parent = findScrollParent(track)
            const view =
                parent === window ? window.innerHeight : parent.clientHeight
            const scrollable = Math.max(0, track.offsetHeight - view)
            const clamped = Math.min(1, Math.max(0, progress))
            const behavior = reducedMotion ? "auto" : "smooth"
            if (parent === window) {
                const top =
                    window.scrollY +
                    track.getBoundingClientRect().top +
                    clamped * scrollable
                window.scrollTo({ top, behavior })
                return
            }
            const top =
                parent.scrollTop +
                (track.getBoundingClientRect().top -
                    parent.getBoundingClientRect().top) +
                clamped * scrollable
            parent.scrollTo({ top, behavior })
        },
        [reducedMotion]
    )

    const goToIndex = useCallback(
        (index: number) => {
            const last = Math.max(count - 1, 1)
            const clamped = Math.max(0, Math.min(count - 1, index))
            scrollTrackTo(count <= 1 ? 0 : clamped / last)
        },
        [count, scrollTrackTo]
    )

    // The page scrollbar scrubs the stack from the first service to the last.
    useIsomorphicLayoutEffect(() => {
        if (!pageLinked || typeof window === "undefined") return
        const track = trackRef.current
        if (!track) return
        const sync = () => {
            const current = layoutRef.current
            if (current.count < 1) return
            const parent = findScrollParent(track)
            const view =
                parent === window ? window.innerHeight : parent.clientHeight
            const scrollable = Math.max(1, track.offsetHeight - view)
            const origin =
                parent === window
                    ? track.getBoundingClientRect().top
                    : track.getBoundingClientRect().top -
                      parent.getBoundingClientRect().top
            const traveled = Math.min(Math.max(-origin, 0), scrollable)
            const progress = current.count <= 1 ? 0 : traveled / scrollable
            const start = centerAt(current, 0)
            const end = centerAt(current, current.count - 1)
            const position = start + (end - start) * progress
            const state = motionState.current
            state.position = position
            state.target = position
            apply()
        }
        sync()
        const parent = findScrollParent(track)
        const target = parent === window ? window : parent
        target.addEventListener("scroll", sync, { passive: true })
        window.addEventListener("resize", sync)
        return () => {
            target.removeEventListener("scroll", sync)
            window.removeEventListener("resize", sync)
        }
    }, [pageLinked, apply, layout])

    useEffect(() => {
        const state = motionState.current
        return () => {
            cancelAnimationFrame(state.frame)
            state.frame = 0
            window.clearTimeout(state.snapTimer)
        }
    }, [])

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return
        drag.current = {
            id: event.pointerId,
            startY: event.clientY,
            lastY: event.clientY,
            lastTime: event.timeStamp,
            velocity: 0,
            moved: false,
        }
    }

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const current = drag.current
        if (current.id !== event.pointerId) return
        if (!current.moved) {
            if (Math.abs(event.clientY - current.startY) < 6) return
            current.moved = true
            window.clearTimeout(motionState.current.snapTimer)
            try {
                event.currentTarget.setPointerCapture(event.pointerId)
            } catch {}
        }
        const deltaY = event.clientY - current.lastY
        const deltaTime = Math.max(1, event.timeStamp - current.lastTime)
        current.velocity = 0.7 * (deltaY / deltaTime) + 0.3 * current.velocity
        current.lastY = event.clientY
        current.lastTime = event.timeStamp
        const state = motionState.current
        state.target -= deltaY
        state.position = state.target
        apply()
    }

    const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
        const current = drag.current
        if (current.id !== event.pointerId) return
        current.id = -1
        if (!current.moved) return
        const state = motionState.current
        state.dragEndedAt = event.timeStamp
        const fling = Math.max(-900, Math.min(900, current.velocity * 260))
        state.target -= fling
        snap()
    }

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const current = mod(
            nearestItem(layout, motionState.current.position),
            count
        )
        if (event.key === "ArrowDown" || event.key === "PageDown") {
            event.preventDefault()
            if (pageLinked) goToIndex(current + 1)
            else step(1)
        } else if (event.key === "ArrowUp" || event.key === "PageUp") {
            event.preventDefault()
            if (pageLinked) goToIndex(current - 1)
            else step(-1)
        }
    }

    const wasDragged = (event: ReactMouseEvent) =>
        event.timeStamp - motionState.current.dragEndedAt < 80

    const onSlotClick = (event: ReactMouseEvent, slot: number) => {
        const state = motionState.current
        if (wasDragged(event)) {
            event.preventDefault()
            return
        }
        const projectIndex = layout.slots[slot].project
        if (pageLinked) {
            const currentIndex = mod(nearestItem(layout, state.position), count)
            if (currentIndex === projectIndex && projects[projectIndex].link)
                return
            event.preventDefault()
            goToIndex(projectIndex)
            return
        }
        const offset = wrap(
            layout.slots[slot].base - state.position,
            layout.total
        )
        const centred = slot === state.slot && Math.abs(offset) < 2
        if (centred && projects[projectIndex].link) return
        event.preventDefault()
        window.clearTimeout(state.snapTimer)
        state.target = state.position + offset
        run()
    }

    const onRowClick = (event: ReactMouseEvent, row: number) => {
        if (wasDragged(event)) return
        if (pageLinked) {
            goToIndex(row)
            return
        }
        const state = motionState.current
        window.clearTimeout(state.snapTimer)
        state.target = centerAt(layout, row)
        run()
    }

    if (count === 0) return null

    const position = motionState.current.position
    const fractional = floatIndex(layout, position)
    const activeSlotIndex = Math.min(active.slot, layout.slots.length - 1)
    const activeIndex = layout.slots[activeSlotIndex].project
    const activeProject = projects[activeIndex]
    const number = String(activeIndex + 1).padStart(2, "0")

    const activeSize = layout.sizes[activeIndex]
    const inset = markerInset * (compact ? 0.7 : 1)

    const steps = Math.max(count - 1, 0)
    const trackHeight = Math.round(
        viewport.height * (1 + steps * (scrollDistance / 100))
    )

    const centerLine: CSSProperties = {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        whiteSpace: "nowrap",
    }

    return (
        <div
            ref={trackRef}
            style={{
                position: "relative",
                width: "100%",
                height: pageLinked ? trackHeight : "100%",
                backgroundColor,
            }}
        >
            <div
                ref={rootRef}
                className="fx-ps-root"
                role="region"
                aria-roledescription="carousel"
                aria-label="Servicios"
                tabIndex={0}
                onKeyDown={isStatic ? undefined : onKeyDown}
                onPointerDown={
                    isStatic || pageLinked ? undefined : onPointerDown
                }
                onPointerMove={
                    isStatic || pageLinked ? undefined : onPointerMove
                }
                onPointerUp={isStatic || pageLinked ? undefined : onPointerEnd}
                onPointerCancel={
                    isStatic || pageLinked ? undefined : onPointerEnd
                }
                style={
                    {
                        position: pageLinked ? "sticky" : "relative",
                        top: 0,
                        width: "100%",
                        height: pageLinked ? "100vh" : "100%",
                        overflow: "hidden",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        touchAction:
                            pageLinked || !captureScroll ? "pan-y" : "none",
                        overscrollBehavior:
                            pageLinked || !captureScroll
                                ? undefined
                                : "contain",
                        backgroundColor,
                        color: textColor,
                        fontSize: 13,
                        lineHeight: 1.2,
                        ...font,
                        fontFamily: '"Montserrat", sans-serif',
                        "--ps-text-dim": textDim,
                        "--ps-text-hover": Math.min(1, textDim + 0.35),
                        "--ps-img-dim": imageDim,
                        "--ps-img-filter": grayscale
                            ? "grayscale(1.2)"
                            : "none",
                    } as CSSProperties
                }
            >
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap"
                />
                <style>{isStatic ? BASE_CSS : BASE_CSS + MOTION_CSS}</style>
                <div
                    className="fx-ps-fade"
                    style={{
                        position: "absolute",
                        inset: 0,
                        opacity: ready || isStatic ? 1 : 0,
                    }}
                >
                    {layout.slots.map((slot, index) => {
                        const project = projects[slot.project]
                        const size = layout.sizes[slot.project]
                        const image = project.image?.src
                            ? project.image
                            : FALLBACK_IMAGES[
                                  slot.project % FALLBACK_IMAGES.length
                              ]
                        const isActive = index === activeSlotIndex
                        return (
                            <a
                                key={index}
                                ref={(element) => {
                                    slotRefs.current[index] = element
                                }}
                                className="fx-ps-item"
                                data-active={isActive}
                                href={project.link || undefined}
                                aria-label={project.title}
                                aria-hidden={isActive ? undefined : true}
                                tabIndex={-1}
                                draggable={false}
                                onClick={(event) => onSlotClick(event, index)}
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    width: size.width,
                                    height: size.height,
                                    display: "block",
                                    overflow: "visible",
                                    cursor: "pointer",
                                    willChange: "transform",
                                    transform: slotTransform(
                                        layout,
                                        index,
                                        position
                                    ),
                                }}
                            >
                                <div className="fx-ps-frame">
                                    <FrameVisual
                                        lottieSrc={fileUrl(project.lottie)}
                                        image={image}
                                        width={size.width}
                                        playing={
                                            isActive &&
                                            !reducedMotion &&
                                            !isStatic
                                        }
                                    />
                                </div>
                            </a>
                        )
                    })}

                    {marker !== "none" && (
                        <Marker
                            width={activeSize.width + inset * 2}
                            // Horizontal strokes sit in the middle of the gap so
                            // they never cross the neighbouring images
                            height={activeSize.height + gap + markerWeight}
                            color={markerColor}
                            size={markerSize}
                            weight={markerWeight}
                            brackets={marker === "brackets"}
                        />
                    )}

                    {showList && !compact && (
                        <nav
                            aria-label="Servicios"
                            style={{
                                position: "absolute",
                                top: "50%",
                                right: padding,
                                width: "min(280px, 34%)",
                                height: listRows * lineHeight,
                                transform: "translateY(-50%)",
                                overflow: "visible",
                                textAlign: "right",
                            }}
                        >
                            {projects.map((project, index) => {
                                return (
                                    <div
                                        key={index}
                                        ref={(element) => {
                                            rowRefs.current[index] = element
                                        }}
                                        className="fx-ps-row"
                                        data-active={index === activeIndex}
                                        role="button"
                                        aria-current={
                                            index === activeIndex
                                                ? "true"
                                                : undefined
                                        }
                                        onClick={(event) =>
                                            onRowClick(event, index)
                                        }
                                        style={{
                                            position: "absolute",
                                            top: "50%",
                                            left: 0,
                                            right: 0,
                                            height: lineHeight,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            textAlign: "right",
                                            willChange: "transform",
                                            transform: rowTransform(
                                                index,
                                                fractional,
                                                lineHeight
                                            ),
                                        }}
                                    >
                                        {project.title}
                                    </div>
                                )
                            })}
                        </nav>
                    )}

                    {showDetails && !compact && (
                        <div style={{ ...centerLine, left: padding }}>
                            <SwapText
                                text={number}
                                direction={active.direction}
                            />
                        </div>
                    )}

                    {showDetails && !compact && (
                        <div
                            style={{
                                position: "absolute",
                                left: padding,
                                top: `calc(50% + ${
                                    activeSize.height / 2 + Math.max(gap, 24)
                                }px)`,
                                width: `min(300px, calc(50% - ${
                                    activeSize.width / 2 + padding + 20
                                }px))`,
                                pointerEvents: "none",
                            }}
                        >
                            <ServiceCopy
                                project={activeProject}
                                tagColor={tagColor}
                            />
                        </div>
                    )}

                    {showDetails && compact && (
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: 0,
                                padding,
                                backgroundColor,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                }}
                            >
                                <span style={{ fontWeight: 700 }}>
                                    {activeProject.title}
                                </span>
                                <span>{number}</span>
                            </div>
                            <ServiceCopy
                                project={activeProject}
                                tagColor={tagColor}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

addPropertyControls(ProjectScroll, {
    // Content
    projects: {
        type: ControlType.Array,
        title: "Services",
        description:
            "Five services by default. Order here is the scroll order.",
        control: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Servicio",
                },
                description: {
                    type: ControlType.String,
                    title: "Description",
                    defaultValue: "Descripción del servicio.",
                    displayTextArea: true,
                },
                tags: {
                    type: ControlType.String,
                    title: "Tags",
                    description: "Comma-separated. Each one becomes a chip.",
                    defaultValue: "Auditoria, Auditoria, Auditoria",
                },
                image: {
                    type: ControlType.ResponsiveImage,
                    title: "Image",
                    description: "Used when this service has no Lottie.",
                },
                lottie: {
                    type: ControlType.File,
                    title: "Lottie",
                    allowedFileTypes: ["json", "lottie"],
                    description:
                        "Replaces the image. Stays on the first frame until this service is centred, then plays.",
                },
                ratio: {
                    type: ControlType.Enum,
                    title: "Ratio",
                    description:
                        "Width to height. The image is cropped to fit.",
                    options: ["1:1", "4:5", "3:4", "2:3", "4:3", "3:2", "16:9"],
                    defaultValue: "1:1",
                },
                size: {
                    type: ControlType.Enum,
                    title: "Size",
                    description: "Share of Image Width this service takes.",
                    options: ["S", "M", "L"],
                    optionTitles: ["Small", "Medium", "Large"],
                    defaultValue: "L",
                    displaySegmentedControl: true,
                },
                link: { type: ControlType.Link, title: "Link" },
            },
        },
        defaultValue: DEFAULT_PROJECTS,
        maxCount: 40,
    },
    showList: {
        type: ControlType.Boolean,
        title: "List",
        description: "Service names on the right. Hidden on phones.",
        defaultValue: true,
    },
    showDetails: {
        type: ControlType.Boolean,
        title: "Details",
        description: "Number, description and tags of the centred service.",
        defaultValue: true,
    },

    // Layout
    imageWidth: {
        type: ControlType.Number,
        title: "Image Width",
        description: "Width of a Large image.",
        defaultValue: 200,
        min: 120,
        max: 520,
        step: 2,
        unit: "px",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 36,
        min: 0,
        max: 96,
        unit: "px",
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        description: "Distance of the text from the edges.",
        defaultValue: 36,
        min: 0,
        max: 80,
        unit: "px",
    },

    // Marker
    marker: {
        type: ControlType.Enum,
        title: "Marker",
        description: "Frames the centred service and resizes to fit it.",
        options: ["corners", "brackets", "none"],
        optionTitles: ["Corners", "Brackets", "None"],
        defaultValue: "none",
    },
    markerColor: {
        type: ControlType.Color,
        title: "Marker Color",
        defaultValue: "#000000",
        hidden: (props) => props.marker === "none",
    },
    markerSize: {
        type: ControlType.Number,
        title: "Marker Size",
        defaultValue: 16,
        min: 4,
        max: 60,
        unit: "px",
        hidden: (props) => props.marker === "none",
    },
    markerWeight: {
        type: ControlType.Number,
        title: "Marker Weight",
        defaultValue: 2,
        min: 1,
        max: 12,
        unit: "px",
        hidden: (props) => props.marker === "none",
    },
    markerInset: {
        type: ControlType.Number,
        title: "Marker Inset",
        description: "Space between the image and the marker, left and right.",
        defaultValue: 14,
        min: 0,
        max: 80,
        unit: "px",
        hidden: (props) => props.marker === "none",
    },

    // Style
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontFamily: "Montserrat",
            fontSize: "13px",
            variant: "Regular",
            letterSpacing: "-0.01em",
            lineHeight: "1.35em",
        },
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#000000",
    },
    textDim: {
        type: ControlType.Number,
        title: "Text Dim",
        description: "Opacity of the names that are not centred.",
        defaultValue: 0.6,
        min: 0.05,
        max: 1,
        step: 0.05,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FFFFFF",
    },
    tagColor: {
        type: ControlType.Color,
        title: "Tag",
        defaultValue: "#B8AFA9",
    },
    grayscale: {
        type: ControlType.Boolean,
        title: "Grayscale",
        description: "Images away from the centre lose their colour.",
        defaultValue: true,
    },
    imageDim: {
        type: ControlType.Number,
        title: "Image Dim",
        description: "Opacity of the images that are not centred.",
        defaultValue: 1,
        min: 0.05,
        max: 1,
        step: 0.05,
    },

    // Behaviour
    pageScroll: {
        type: ControlType.Boolean,
        title: "Page Scroll",
        description:
            "The page scrollbar moves the services. In the layout panel, set Height to Auto so the section can extend the page.",
        defaultValue: true,
    },
    scrollDistance: {
        type: ControlType.Number,
        title: "Scroll Distance",
        description:
            "How far the page travels for each service, as a share of the screen height.",
        defaultValue: 60,
        min: 40,
        max: 160,
        step: 5,
        unit: "%",
        hidden: (props) => !props.pageScroll,
    },
    captureScroll: {
        type: ControlType.Boolean,
        title: "Capture Scroll",
        description:
            "Used when Page Scroll is off. Wheel and touch move the services instead of the page.",
        defaultValue: true,
        hidden: (props) => props.pageScroll,
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        description: "How far one wheel step moves the services.",
        defaultValue: 1,
        min: 0.2,
        max: 3,
        step: 0.1,
        hidden: (props) => props.pageScroll || !props.captureScroll,
    },
    smoothness: {
        type: ControlType.Number,
        title: "Smoothness",
        description: "Higher values glide longer before settling.",
        defaultValue: 5,
        min: 1,
        max: 10,
        step: 1,
        hidden: (props) => props.pageScroll,
    },
})

ProjectScroll.displayName = "Service Scroll"
