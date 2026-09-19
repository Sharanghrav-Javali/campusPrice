// Category Configuration and Specification Schemas for CampusPrice
// Dynamic, category-aware research and comparison engine.

export const CATEGORIES = {
  laptop: {
    id: "laptop",
    label: "Laptop",
    icon: "💻",
    description: "Laptops & Notebooks",
    searchKeywords: ["laptop", "notebook", "ultrabook", "macbook", "thinkpad", "vivobook", "ideapad"],
    keyAttributes: [
      { key: "processor", label: "Processor" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "display", label: "Display" },
      { key: "battery", label: "Battery Life" },
      { key: "weight", label: "Weight" },
      { key: "gpu", label: "Graphics / GPU" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  phone: {
    id: "phone",
    label: "Smartphone",
    icon: "📱",
    description: "Smartphones & Mobile Devices",
    searchKeywords: ["phone", "smartphone", "mobile", "iphone", "galaxy", "redmi", "realme", "oneplus", "pixel"],
    keyAttributes: [
      { key: "processor", label: "Processor" },
      { key: "ram_storage", label: "RAM & Storage" },
      { key: "display", label: "Display & Refresh Rate" },
      { key: "camera", label: "Camera Setup" },
      { key: "battery", label: "Battery & Charging" },
      { key: "connectivity", label: "5G & Connectivity" },
      { key: "os", label: "OS & Updates" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  headphones: {
    id: "headphones",
    label: "Headphones & Audio",
    icon: "🎧",
    description: "Over-ear, On-ear, and In-ear Earbuds",
    searchKeywords: ["headphone", "headphones", "earbuds", "earphone", "airpods", "tws", "iem"],
    keyAttributes: [
      { key: "anc", label: "Active Noise Cancellation" },
      { key: "battery", label: "Battery / Playtime" },
      { key: "driver", label: "Driver Size & Sound" },
      { key: "codec", label: "Bluetooth & Codecs" },
      { key: "mic", label: "Microphone Quality" },
      { key: "weight", label: "Weight & Comfort" },
      { key: "water_resistance", label: "Water Resistance" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  shoes: {
    id: "shoes",
    label: "Shoes & Footwear",
    icon: "👟",
    description: "Sneakers, Running Shoes, College & Formal Footwear",
    searchKeywords: ["shoe", "shoes", "sneaker", "sneakers", "boots", "loafers", "footwear"],
    keyAttributes: [
      { key: "material", label: "Upper Material" },
      { key: "sole", label: "Sole & Cushioning" },
      { key: "use_case", label: "Ideal Use / Occasion" },
      { key: "comfort", label: "Comfort & Fit" },
      { key: "maintenance", label: "Care & Durability" },
      { key: "closure", label: "Closure Type" },
    ],
  },
  monitor: {
    id: "monitor",
    label: "Monitor",
    icon: "🖥️",
    description: "Computer Monitors & Displays",
    searchKeywords: ["monitor", "display", "screen", "panel"],
    keyAttributes: [
      { key: "screen_size", label: "Screen Size" },
      { key: "resolution", label: "Resolution" },
      { key: "refresh_rate", label: "Refresh Rate" },
      { key: "panel_type", label: "Panel Type (IPS/VA/OLED)" },
      { key: "response_time", label: "Response Time" },
      { key: "ports", label: "Ports (HDMI/DP/Type-C)" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  keyboard: {
    id: "keyboard",
    label: "Keyboard",
    icon: "⌨️",
    description: "Mechanical & Wireless Keyboards",
    searchKeywords: ["keyboard", "mechanical keyboard", "keeb"],
    keyAttributes: [
      { key: "switch_type", label: "Switch Type" },
      { key: "layout", label: "Layout / Form Factor" },
      { key: "connectivity", label: "Connectivity (Wireless/BT/Wired)" },
      { key: "battery", label: "Battery Life" },
      { key: "backlight", label: "Backlighting" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  mouse: {
    id: "mouse",
    label: "Mouse",
    icon: "🖱️",
    description: "Productivity & Gaming Mice",
    searchKeywords: ["mouse", "mice", "trackpad", "trackball"],
    keyAttributes: [
      { key: "dpi", label: "DPI & Sensor" },
      { key: "connectivity", label: "Connectivity" },
      { key: "battery", label: "Battery Life" },
      { key: "weight", label: "Weight" },
      { key: "buttons", label: "Buttons / Programmable" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  tablet: {
    id: "tablet",
    label: "Tablet",
    icon: "📟",
    description: "Tablets & iPads",
    searchKeywords: ["tablet", "ipad", "tab"],
    keyAttributes: [
      { key: "screen", label: "Screen Size & Quality" },
      { key: "processor", label: "Processor" },
      { key: "ram_storage", label: "RAM & Storage" },
      { key: "stylus", label: "Stylus / Pencil Support" },
      { key: "battery", label: "Battery Life" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  smartwatch: {
    id: "smartwatch",
    label: "Smartwatch",
    icon: "⌚",
    description: "Smartwatches & Fitness Bands",
    searchKeywords: ["smartwatch", "watch", "fitness band", "band"],
    keyAttributes: [
      { key: "display", label: "Display" },
      { key: "battery", label: "Battery Life" },
      { key: "sensors", label: "Sensors & Tracking" },
      { key: "water_resistance", label: "Water Resistance" },
      { key: "calling", label: "Bluetooth Calling" },
      { key: "warranty", label: "Warranty" },
    ],
  },
  generic: {
    id: "generic",
    label: "Product",
    icon: "📦",
    description: "General Consumer Products",
    searchKeywords: [],
    keyAttributes: [
      { key: "key_specs", label: "Key Specifications" },
      { key: "build_material", label: "Material & Build" },
      { key: "dimensions", label: "Dimensions / Form" },
      { key: "warranty", label: "Warranty" },
    ],
  },
};

/**
 * Detect probable category from text heuristics
 */
export function detectCategoryFromText(text = "") {
  const lower = text.toLowerCase();
  for (const [catId, conf] of Object.entries(CATEGORIES)) {
    if (catId === "generic") continue;
    if (conf.searchKeywords.some((kw) => lower.includes(kw))) {
      return catId;
    }
  }
  return "generic";
}

/**
 * Get category configuration, defaulting to generic
 */
export function getCategoryConfig(categoryId) {
  return CATEGORIES[categoryId] || CATEGORIES.generic;
}

/**
 * Get category key comparison attributes
 */
export function getComparisonAttributes(categoryId) {
  const conf = getCategoryConfig(categoryId);
  return conf.keyAttributes;
}
