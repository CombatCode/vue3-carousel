/**
 * Vue 3 Carousel 0.1.41
 * (c) 2022
 * @license MIT
 */
import { defineComponent, ref, reactive, provide, onMounted, nextTick, onUnmounted, computed, watch, watchEffect, h, inject } from 'vue';

const defaultConfigs = {
    itemsToShow: 1,
    itemsToScroll: 1,
    modelValue: 0,
    transition: 300,
    autoplay: 0,
    snapAlign: 'center',
    wrapAround: false,
    pauseAutoplayOnHover: false,
    mouseDrag: true,
    touchDrag: true,
    dir: 'ltr',
    breakpoints: undefined,
};

/**
 * return a debounced version of the function
 * @param fn
 * @param delay
 */
// eslint-disable-next-line no-unused-vars
function debounce(fn, delay) {
    let timerId;
    return function (...args) {
        if (timerId) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(() => {
            fn(...args);
            timerId = null;
        }, delay);
    };
}
/**
 * return a throttle version of the function
 * Throttling
 *
 */
// eslint-disable-next-line no-unused-vars
function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        const self = this;
        if (!inThrottle) {
            fn.apply(self, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
function getSlidesVNodes(vNode) {
    var _a, _b, _c;
    // Return empty array if there's any node
    if (!vNode)
        return [];
    // Check if the Slides components are added directly without v-for (#72)
    if (((_b = (_a = vNode[0]) === null || _a === void 0 ? void 0 : _a.type) === null || _b === void 0 ? void 0 : _b.name) === 'CarouselSlide')
        return vNode;
    return ((_c = vNode[0]) === null || _c === void 0 ? void 0 : _c.children) || [];
}
function getMaxSlideIndex(config, slidesCount) {
    if (config.wrapAround) {
        return slidesCount - 1;
    }
    switch (config.snapAlign) {
        case 'start':
            return slidesCount - config.itemsToShow;
        case 'end':
            return slidesCount - 1;
        case 'center':
        case 'center-odd':
            return slidesCount - Math.ceil(config.itemsToShow / 2);
        case 'center-even':
            return slidesCount - Math.ceil(config.itemsToShow / 2);
        default:
            return 0;
    }
}
function getMinSlideIndex(config) {
    if (config.wrapAround) {
        return 0;
    }
    switch (config.snapAlign) {
        case 'start':
            return 0;
        case 'end':
            return config.itemsToShow - 1;
        case 'center':
        case 'center-odd':
            return Math.floor((config.itemsToShow - 1) / 2);
        case 'center-even':
            return Math.floor((config.itemsToShow - 2) / 2);
        default:
            return 0;
    }
}
function getCurrentSlideIndex(config, val, max, min) {
    if (config.wrapAround) {
        return val;
    }
    return Math.min(Math.max(val, min), max);
}
function getSlidesToScroll({ slidesBuffer, currentSlide, snapAlign, itemsToShow, wrapAround, slidesCount, }) {
    let output = slidesBuffer.indexOf(currentSlide);
    if (output === -1) {
        output = slidesBuffer.indexOf(Math.ceil(currentSlide));
    }
    if (snapAlign === 'center' || snapAlign === 'center-odd') {
        output -= (itemsToShow - 1) / 2;
    }
    else if (snapAlign === 'center-even') {
        output -= (itemsToShow - 2) / 2;
    }
    else if (snapAlign === 'end') {
        output -= itemsToShow - 1;
    }
    if (!wrapAround) {
        const max = slidesCount - itemsToShow;
        const min = 0;
        output = Math.max(Math.min(output, max), min);
    }
    return output;
}

var Carousel = defineComponent({
    name: 'Carousel',
    props: {
        // count of items to showed per view
        itemsToShow: {
            default: defaultConfigs.itemsToShow,
            type: Number,
        },
        // count of items to be scrolled
        itemsToScroll: {
            default: defaultConfigs.itemsToScroll,
            type: Number,
        },
        // control infinite scrolling mode
        wrapAround: {
            default: defaultConfigs.wrapAround,
            type: Boolean,
        },
        // control snap position alignment
        snapAlign: {
            default: defaultConfigs.snapAlign,
            validator(value) {
                // The value must match one of these strings
                return ['start', 'end', 'center', 'center-even', 'center-odd'].includes(value);
            },
        },
        // sliding transition time in ms
        transition: {
            default: defaultConfigs.transition,
            type: Number,
        },
        // an object to store breakpoints
        breakpoints: {
            default: defaultConfigs.breakpoints,
            type: Object,
        },
        // time to auto advance slides in ms
        autoplay: {
            default: defaultConfigs.autoplay,
            type: Number,
        },
        // pause autoplay when mouse hover over the carousel
        pauseAutoplayOnHover: {
            default: defaultConfigs.pauseAutoplayOnHover,
            type: Boolean,
        },
        // slide number number of initial slide
        modelValue: {
            default: undefined,
            type: Number,
        },
        // toggle mouse dragging.
        mouseDrag: {
            default: defaultConfigs.mouseDrag,
            type: Boolean,
        },
        // toggle mouse dragging.
        touchDrag: {
            default: defaultConfigs.touchDrag,
            type: Boolean,
        },
        // control snap position alignment
        dir: {
            default: defaultConfigs.dir,
            validator(value) {
                // The value must match one of these strings
                return ['rtl', 'ltr'].includes(value);
            },
        },
        // an object to pass all settings
        settings: {
            default() {
                return {};
            },
            type: Object,
        },
    },
    setup(props, { slots, emit, expose }) {
        var _a;
        const root = ref(null);
        const slides = ref([]);
        const slidesBuffer = ref([]);
        const slideWidth = ref(0);
        const slidesCount = ref(1);
        const autoplayTimer = ref(null);
        const transitionTimer = ref(null);
        let breakpoints = ref({});
        // generate carousel configs
        let __defaultConfig = Object.assign({}, defaultConfigs);
        // current config
        const config = reactive(Object.assign({}, __defaultConfig));
        // slides
        const currentSlideIndex = ref((_a = config.modelValue) !== null && _a !== void 0 ? _a : 0);
        const prevSlideIndex = ref(0);
        const middleSlideIndex = ref(0);
        const maxSlideIndex = ref(0);
        const minSlideIndex = ref(0);
        provide('config', config);
        provide('slidesBuffer', slidesBuffer);
        provide('slidesCount', slidesCount);
        provide('currentSlide', currentSlideIndex);
        provide('maxSlide', maxSlideIndex);
        provide('minSlide', minSlideIndex);
        /**
         * Configs
         */
        function initDefaultConfigs() {
            // generate carousel configs
            const mergedConfigs = Object.assign(Object.assign({}, props), props.settings);
            // Set breakpoints
            breakpoints = ref(Object.assign({}, mergedConfigs.breakpoints));
            // remove extra values
            __defaultConfig = Object.assign(Object.assign({}, mergedConfigs), { settings: undefined, breakpoints: undefined });
            bindConfigs(__defaultConfig);
        }
        function updateBreakpointsConfigs() {
            const breakpointsArray = Object.keys(breakpoints.value)
                .map((key) => Number(key))
                .sort((a, b) => +b - +a);
            let newConfig = Object.assign({}, __defaultConfig);
            breakpointsArray.some((breakpoint) => {
                const isMatched = window.matchMedia(`(min-width: ${breakpoint}px)`).matches;
                if (isMatched) {
                    newConfig = Object.assign(Object.assign({}, newConfig), breakpoints.value[breakpoint]);
                    return true;
                }
                return false;
            });
            bindConfigs(newConfig);
        }
        function bindConfigs(newConfig) {
            for (let key in newConfig) {
                // @ts-ignore
                config[key] = newConfig[key];
            }
        }
        const handleWindowResize = debounce(() => {
            if (breakpoints.value) {
                updateBreakpointsConfigs();
                updateSlidesData();
            }
            updateSlideWidth();
        }, 16);
        /**
         * Setup functions
         */
        function updateSlideWidth() {
            if (!root.value)
                return;
            const rect = root.value.getBoundingClientRect();
            slideWidth.value = rect.width / config.itemsToShow;
        }
        function updateSlidesData() {
            slidesCount.value = Math.max(slides.value.length, 1);
            if (slidesCount.value <= 0)
                return;
            middleSlideIndex.value = Math.ceil((slidesCount.value - 1) / 2);
            maxSlideIndex.value = getMaxSlideIndex(config, slidesCount.value);
            minSlideIndex.value = getMinSlideIndex(config);
            currentSlideIndex.value = getCurrentSlideIndex(config, currentSlideIndex.value, maxSlideIndex.value, minSlideIndex.value);
        }
        function updateSlidesBuffer() {
            const slidesArray = [...Array(slidesCount.value).keys()];
            const shouldShiftSlides = config.wrapAround && config.itemsToShow + 1 <= slidesCount.value;
            if (shouldShiftSlides) {
                const buffer = config.itemsToShow !== 1
                    ? Math.round((slidesCount.value - config.itemsToShow) / 2)
                    : 0;
                let shifts = buffer - currentSlideIndex.value;
                if (config.snapAlign === 'end') {
                    shifts += Math.floor(config.itemsToShow - 1);
                }
                else if (config.snapAlign === 'center' || config.snapAlign === 'center-odd') {
                    shifts++;
                }
                // Check shifting directions
                if (shifts < 0) {
                    for (let i = shifts; i < 0; i++) {
                        slidesArray.push(Number(slidesArray.shift()));
                    }
                }
                else {
                    for (let i = 0; i < shifts; i++) {
                        slidesArray.unshift(Number(slidesArray.pop()));
                    }
                }
            }
            slidesBuffer.value = slidesArray;
        }
        onMounted(() => {
            if (breakpoints.value) {
                updateBreakpointsConfigs();
                updateSlidesData();
            }
            nextTick(() => setTimeout(updateSlideWidth, 16));
            if (config.autoplay && config.autoplay > 0) {
                initializeAutoplay();
            }
            window.addEventListener('resize', handleWindowResize, { passive: true });
        });
        onUnmounted(() => {
            if (transitionTimer.value) {
                clearTimeout(transitionTimer.value);
            }
            resetAutoplayTimer(false);
        });
        /**
         * Carousel Event listeners
         */
        let isTouch = false;
        const startPosition = { x: 0, y: 0 };
        const endPosition = { x: 0, y: 0 };
        const dragged = reactive({ x: 0, y: 0 });
        const isDragging = ref(false);
        const isHover = ref(false);
        const handleMouseEnter = () => {
            isHover.value = true;
        };
        const handleMouseLeave = () => {
            isHover.value = false;
        };
        const handleDrag = throttle((event) => {
            if (!isTouch)
                event.preventDefault();
            endPosition.x = isTouch ? event.touches[0].clientX : event.clientX;
            endPosition.y = isTouch ? event.touches[0].clientY : event.clientY;
            const deltaX = endPosition.x - startPosition.x;
            const deltaY = endPosition.y - startPosition.y;
            dragged.y = deltaY;
            dragged.x = deltaX;
        }, 16);
        function handleDragStart(event) {
            isTouch = event.type === 'touchstart';
            if (!isTouch)
                event.preventDefault();
            if ((!isTouch && event.button !== 0) || isSliding.value) {
                return;
            }
            isDragging.value = true;
            startPosition.x = isTouch ? event.touches[0].clientX : event.clientX;
            startPosition.y = isTouch ? event.touches[0].clientY : event.clientY;
            document.addEventListener(isTouch ? 'touchmove' : 'mousemove', handleDrag);
            document.addEventListener(isTouch ? 'touchend' : 'mouseup', handleDragEnd);
        }
        function handleDragEnd() {
            isDragging.value = false;
            const direction = config.dir === 'rtl' ? -1 : 1;
            const tolerance = Math.sign(dragged.x) * 0.4;
            const draggedSlides = Math.round(dragged.x / slideWidth.value + tolerance) * direction;
            let newSlide = getCurrentSlideIndex(config, currentSlideIndex.value - draggedSlides, maxSlideIndex.value, minSlideIndex.value);
            slideTo(newSlide);
            dragged.x = 0;
            dragged.y = 0;
            document.removeEventListener(isTouch ? 'touchmove' : 'mousemove', handleDrag);
            document.removeEventListener(isTouch ? 'touchend' : 'mouseup', handleDragEnd);
        }
        /**
         * Autoplay
         */
        function initializeAutoplay() {
            autoplayTimer.value = setInterval(() => {
                if (config.pauseAutoplayOnHover && isHover.value) {
                    return;
                }
                next();
            }, config.autoplay);
        }
        function resetAutoplayTimer(restart = true) {
            if (!autoplayTimer.value) {
                return;
            }
            clearInterval(autoplayTimer.value);
            if (restart) {
                initializeAutoplay();
            }
        }
        /**
         * Navigation function
         */
        const isSliding = ref(false);
        function slideTo(slideIndex, mute = false) {
            resetAutoplayTimer();
            if (currentSlideIndex.value === slideIndex || isSliding.value) {
                return;
            }
            // Wrap slide index
            const lastSlideIndex = slidesCount.value - 1;
            if (slideIndex > lastSlideIndex) {
                return slideTo(slideIndex - slidesCount.value);
            }
            if (slideIndex < 0) {
                return slideTo(slideIndex + slidesCount.value);
            }
            isSliding.value = true;
            prevSlideIndex.value = currentSlideIndex.value;
            currentSlideIndex.value = slideIndex;
            if (!mute) {
                emit('update:modelValue', currentSlideIndex.value);
            }
            transitionTimer.value = setTimeout(() => {
                if (config.wrapAround)
                    updateSlidesBuffer();
                isSliding.value = false;
            }, config.transition);
        }
        function next() {
            let nextSlide = currentSlideIndex.value + config.itemsToScroll;
            if (!config.wrapAround) {
                nextSlide = Math.min(nextSlide, maxSlideIndex.value);
            }
            slideTo(nextSlide);
        }
        function prev() {
            let prevSlide = currentSlideIndex.value - config.itemsToScroll;
            if (!config.wrapAround) {
                prevSlide = Math.max(prevSlide, minSlideIndex.value);
            }
            slideTo(prevSlide);
        }
        const nav = { slideTo, next, prev };
        provide('nav', nav);
        /**
         * Track style
         */
        const slidesToScroll = computed(() => getSlidesToScroll({
            slidesBuffer: slidesBuffer.value,
            itemsToShow: config.itemsToShow,
            snapAlign: config.snapAlign,
            wrapAround: Boolean(config.wrapAround),
            currentSlide: currentSlideIndex.value,
            slidesCount: slidesCount.value,
        }));
        provide('slidesToScroll', slidesToScroll);
        const trackStyle = computed(() => {
            const direction = config.dir === 'rtl' ? -1 : 1;
            const xScroll = slidesToScroll.value * slideWidth.value * direction;
            return {
                transform: `translateX(${dragged.x - xScroll}px)`,
                transition: `${isSliding.value ? config.transition : 0}ms`,
            };
        });
        function initCarousel() {
            initDefaultConfigs();
        }
        function restartCarousel() {
            initDefaultConfigs();
            updateBreakpointsConfigs();
            updateSlidesData();
            updateSlidesBuffer();
            updateSlideWidth();
        }
        function updateCarousel() {
            updateSlidesData();
            updateSlidesBuffer();
        }
        // Update the carousel on props change
        watch(() => Object.values(props), restartCarousel);
        // Init carousel
        initCarousel();
        watchEffect(() => {
            // Handel when slides added/removed
            const needToUpdate = slidesCount.value !== slides.value.length;
            const currentSlideUpdated = props.modelValue !== undefined && currentSlideIndex.value !== props.modelValue;
            if (currentSlideUpdated) {
                slideTo(Number(props.modelValue), true);
            }
            if (needToUpdate) {
                updateCarousel();
            }
        });
        const data = {
            config,
            slidesBuffer,
            slidesCount,
            slideWidth,
            currentSlide: currentSlideIndex,
            maxSlide: maxSlideIndex,
            minSlide: minSlideIndex,
            middleSlide: middleSlideIndex,
        };
        expose({
            updateBreakpointsConfigs,
            updateSlidesData,
            updateSlideWidth,
            updateSlidesBuffer,
            initCarousel,
            restartCarousel,
            updateCarousel,
            slideTo,
            next,
            prev,
            nav,
            data,
        });
        const slotSlides = slots.default || slots.slides;
        const slotAddons = slots.addons;
        const slotsProps = reactive(data);
        return () => {
            const slidesElements = getSlidesVNodes(slotSlides === null || slotSlides === void 0 ? void 0 : slotSlides(slotsProps));
            const addonsElements = (slotAddons === null || slotAddons === void 0 ? void 0 : slotAddons(slotsProps)) || [];
            slides.value = slidesElements;
            // Bind slide order
            slidesElements.forEach((el, index) => (el.props.index = index));
            const trackEl = h('ol', {
                class: 'carousel__track',
                style: trackStyle.value,
                onMousedown: config.mouseDrag ? handleDragStart : null,
                onTouchstart: config.touchDrag ? handleDragStart : null,
            }, slidesElements);
            const viewPortEl = h('div', { class: 'carousel__viewport' }, trackEl);
            return h('section', {
                ref: root,
                class: {
                    carousel: true,
                    'carousel--rtl': config.dir === 'rtl',
                },
                dir: config.dir,
                'aria-label': 'Gallery',
                onMouseenter: handleMouseEnter,
                onMouseleave: handleMouseLeave,
            }, [viewPortEl, addonsElements]);
        };
    },
});

const icons = {
    arrowUp: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z',
    arrowDown: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z',
    arrowRight: 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z',
    arrowLeft: 'M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z',
};

const Icon = (props) => {
    const iconName = props.name;
    if (!iconName || typeof iconName !== 'string') {
        return;
    }
    const path = icons[iconName];
    const pathEl = h('path', { d: path });
    const iconTitle = props.title || iconName;
    const titleEl = h('title', null, iconName);
    return h('svg', {
        class: 'carousel__icon',
        viewBox: '0 0 24 24',
        role: 'img',
        ariaLabel: iconTitle,
    }, [titleEl, pathEl]);
};
Icon.props = { name: String, title: String };

const Navigation = (props, { slots, attrs }) => {
    const { next: slotNext, prev: slotPrev } = slots;
    const config = inject('config', reactive(Object.assign({}, defaultConfigs)));
    const maxSlide = inject('maxSlide', ref(1));
    const minSlide = inject('minSlide', ref(1));
    const currentSlide = inject('currentSlide', ref(1));
    const nav = inject('nav', {});
    const isRTL = config.dir === 'rtl';
    const prevButton = h('button', {
        type: 'button',
        class: [
            'carousel__prev',
            !config.wrapAround &&
                currentSlide.value <= minSlide.value &&
                'carousel__prev--in-active',
            attrs === null || attrs === void 0 ? void 0 : attrs.class,
        ],
        'aria-label': `Navigate to previous slide`,
        onClick: nav.prev,
    }, (slotPrev === null || slotPrev === void 0 ? void 0 : slotPrev()) || h(Icon, { name: isRTL ? 'arrowRight' : 'arrowLeft' }));
    const nextButton = h('button', {
        type: 'button',
        class: [
            'carousel__next',
            !config.wrapAround &&
                currentSlide.value >= maxSlide.value &&
                'carousel__next--in-active',
            attrs === null || attrs === void 0 ? void 0 : attrs.class,
        ],
        'aria-label': `Navigate to next slide`,
        onClick: nav.next,
    }, (slotNext === null || slotNext === void 0 ? void 0 : slotNext()) || h(Icon, { name: isRTL ? 'arrowLeft' : 'arrowRight' }));
    return [prevButton, nextButton];
};

var Slide = defineComponent({
    name: 'CarouselSlide',
    props: {
        index: {
            type: Number,
            default: 1,
        },
    },
    setup(props, { slots }) {
        const config = inject('config', reactive(Object.assign({}, defaultConfigs)));
        const slidesBuffer = inject('slidesBuffer', ref([]));
        const currentSlide = inject('currentSlide', ref(0));
        const slidesToScroll = inject('slidesToScroll', ref(0));
        const wrapOrder = ref(props.index);
        if (config.wrapAround) {
            updateOrder();
            watch(slidesBuffer, updateOrder);
        }
        function updateOrder() {
            wrapOrder.value = slidesBuffer.value.indexOf(props.index);
        }
        const slideStyle = computed(() => {
            const items = config.itemsToShow;
            const width = `${(1 / items) * 100}%`;
            return {
                width,
                order: wrapOrder.value.toString(),
            };
        });
        const isActive = () => props.index === currentSlide.value;
        const isClosest = () => {
            return ((props.index + 1) === currentSlide.value || (props.index - 1) === currentSlide.value);
        };
        const isVisible = () => {
            const min = Math.ceil(slidesToScroll.value);
            const max = Math.floor(slidesToScroll.value + config.itemsToShow);
            const current = slidesBuffer.value.slice(min, max);
            return current.includes(props.index);
        };
        const isPrev = () => props.index === slidesBuffer.value[Math.ceil(slidesToScroll.value) - 1];
        const isNext = () => props.index ===
            slidesBuffer.value[Math.floor(slidesToScroll.value + config.itemsToShow)];
        return () => {
            var _a;
            return h('li', {
                style: slideStyle.value,
                order: wrapOrder.value.toString(),
                class: {
                    carousel__slide: true,
                    'carousel__slide--order': true,
                    'carousel__slide--active': isActive(),
                    'carousel__slide--visible': isVisible(),
                    'carousel__slide--prev': isPrev(),
                    'carousel__slide--next': isNext(),
                    'carousel__slide--closest': isClosest(),
                },
            }, (_a = slots.default) === null || _a === void 0 ? void 0 : _a.call(slots));
        };
    },
});

const Pagination = () => {
    const maxSlide = inject('maxSlide', ref(1));
    const minSlide = inject('minSlide', ref(1));
    const currentSlide = inject('currentSlide', ref(1));
    const nav = inject('nav', {});
    function handleButtonClick(slideNumber) {
        nav.slideTo(slideNumber);
    }
    const isActive = (slide) => {
        const val = currentSlide.value;
        return (val === slide ||
            (val > maxSlide.value && slide >= maxSlide.value) ||
            (val < minSlide.value && slide <= minSlide.value));
    };
    const children = [];
    for (let slide = minSlide.value; slide < maxSlide.value + 1; slide++) {
        const button = h('button', {
            type: 'button',
            class: {
                'carousel__pagination-button': true,
                'carousel__pagination-button--active': isActive(slide),
            },
            'aria-label': `Navigate to slide ${slide + 1}`,
            onClick: () => handleButtonClick(slide),
        });
        const item = h('li', { class: 'carousel__pagination-item', key: slide }, button);
        children.push(item);
    }
    return h('ol', { class: 'carousel__pagination' }, children);
};

export { Carousel, Icon, Navigation, Pagination, Slide };
