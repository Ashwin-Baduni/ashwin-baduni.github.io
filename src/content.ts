// Main site copy and links. Animated demonstration text lives with its component.
// Demo text (the Yoru question, the plate, the session excerpt) lives in its demo component.

export const person = {
  name: "Ashwin Baduni",
  role: "Co-founder at MihawkAI",
  email: "baduniashwin@gmail.com",
  cv: "/files/CV.pdf",
  linkedin: "https://www.linkedin.com/in/ashwinbaduni/",
  github: "https://github.com/Ashwin-Baduni",
};

export const hero = {
  // The highlighted phrase is split out so the marker can animate behind it.
  // Two sentences, each starting on its own line.
  ledeFirst: "I care about what happens when AI becomes part of someone’s life.",
  ledeBefore: "I build with",
  ledeMark: "that responsibility in mind",
  ledeAfter: ".",
};

export const about = {
  title: "About me",
  // {blue:…} and {pink:…} mark the highlighted phrases: blue for the AI, pink for the product.
  paragraphs: [
    "I’m a co-founder of MihawkAI. I got into AI because I wanted to build things that solve problems people actually have.",
    "Most of my work sits between the model and the person using it. I {blue:train models} that make sense of what cameras see and build agents you can simply talk to. Then I {pink:design the product} around them so it feels effortless to use.",
    "The products will keep changing as we grow. How I build them won’t. I test everything against messy reality and stay honest about its limits. And I make sure people stay in charge of the decisions that matter.",
  ],
  focusTitle: "What I do",
  focus: [
    {
      area: "Computer vision",
      detail:
        "Teaching models to recognise people and vehicles and to follow what happens across cameras.",
      tools: ["PyTorch", "YOLO", "OpenCV", "Triton"],
    },
    {
      area: "AI agents",
      detail:
        "Connecting language models to real tools and data so they can dig into a question and show their evidence.",
      tools: ["LLMs", "vLLM", "Retrieval", "Text-to-SQL"],
    },
    {
      area: "Machine learning",
      detail:
        "Turning raw data into models that keep working outside the training set.",
      tools: ["PyTorch", "TensorFlow", "CUDA"],
    },
    {
      area: "Product engineering",
      detail:
        "Designing the interfaces and building the systems that put models in people’s hands.",
      tools: [
        "Python",
        "TypeScript",
        "React",
        "FastAPI",
        "PostgreSQL",
        "Docker",
      ],
    },
  ],
};

export type ProductPart = {
  name: string;
  text: string;
  contribution?: string;
  demo: "plate" | "agent" | "match" | "transcript";
};
export type Product = {
  id: string;
  kind: string;
  name: string;
  text: string;
  labels?: string[];
  contribution?: string;
  href: string;
  linkLabel: string;
  parts: [ProductPart, ProductPart];
};

export const building: { title: string; products: Product[] } = {
  title: "What we're building",
  products: [
    {
      id: "mihawk",
      kind: "Spatial AI",
      name: "MihawkAI",
      text: "MihawkAI turns the cameras a site already has into a searchable memory of everything that happens there. Our AI agent Yoru answers questions about it in plain language and shows you the events and statistics behind every answer.",
      labels: ["Attendance", "Access control", "Vehicle events"],
      contribution:
        "I built much of Yoru, including its interface, and work on model training and vision detection.",
      href: "https://mihawk.ai",
      linkLabel: "mihawk.ai",
      parts: [
        {
          name: "Vision",
          text: "From a detection to a record.",
          contribution:
            "My work includes training vision models and developing detection for people, clothing, and vehicles.",
          demo: "plate",
        },
        {
          name: "Yoru",
          text: "Questions answered from recorded events.",
          contribution:
            "I've built much of Yoru, from its agent functionality to its user interface.",
          demo: "agent",
        },
      ],
    },
    {
      id: "kehsun",
      kind: "Care",
      name: "Kehsun",
      text: "Kehsun helps people find a practitioner who suits them and book a session online. For practitioners it takes care of the business side of private practice so they can spend less time on admin and more time on the work they love.",
      contribution:
        "I built the session transcription functionality and designed Kehsun's website, alongside work across the wider platform.",
      href: "https://kehsun.com",
      linkLabel: "kehsun.com",
      parts: [
        {
          name: "For people",
          text: "From finding support to your first session.",
          demo: "match",
        },
        {
          name: "For practitioners",
          text: "From conversation to a reviewed session note.",
          demo: "transcript",
        },
      ],
    },
  ],
};

export type Role = {
  org: string;
  orgShort?: string;
  href?: string;
  title: string;
  dates: string;
  text: string;
  tags: string[];
};

export const experience: {
  title: string;
  roles: Role[];
  education: { school: string; href: string; degree: string; dates: string };
  certificates: { name: string; href: string }[];
} = {
  title: "Experience",
  roles: [
    {
      org: "MihawkAI",
      href: "https://mihawk.ai",
      title: "Co-founder",
      dates: "2025 - Present",
      text: "Part of the founding team deciding what we build next. My work spans the AI underneath our products and the experience people see on top.",
      tags: [
        "Python",
        "PyTorch",
        "YOLO",
        "Triton",
        "vLLM",
        "PostgreSQL",
        "TypeScript",
      ],
    },
    {
      org: "National Informatics Centre",
      orgShort: "NIC",
      href: "https://www.nic.in",
      title: "AI Software Intern",
      dates: "Jan - Apr 2025",
      text: "Built an AI assistant for vehicle registration support, with a FastAPI backend, CAPTCHA-protected access and live analytics dashboards.",
      tags: ["FastAPI", "LLMs", "NLP", "Analytics"],
    },
    {
      org: "Gurugram Metropolitan Development Authority",
      orgShort: "GMDA",
      href: "https://www.gmda.gov.in",
      title: "Full-Stack Intern",
      dates: "Jun - Aug 2022",
      text: "Rebuilt the interface of an internal infrastructure dashboard to be responsive and accessible, and worked with the backend team to cut manual data entry.",
      tags: ["JavaScript", "Bootstrap", "REST APIs"],
    },
  ],
  education: {
    school: "Mahindra University",
    href: "https://www.mahindrauniversity.edu.in/",
    degree: "B.Tech, Computational Mathematics",
    dates: "2021 - 2025",
  },
  certificates: [
    {
      name: "Google Cybersecurity",
      href: "https://www.coursera.org/account/accomplishments/professional-cert/certificate/DXRLYIKE4D2T",
    },
    {
      name: "IBM Data Analyst",
      href: "https://www.coursera.org/account/accomplishments/professional-cert/certificate/9WRKVKV2DUIH",
    },
    {
      name: "IRM Enterprise Risk Management, Level 1",
      href: "https://www.theirmindia.org/",
    },
  ],
};

export type Project = {
  id: "motion" | "analytics" | "captcha";
  name: string;
  year: string;
  text: string;
  tags: string[];
  href: string;
  award?: string;
};

const gh = (repo: string) => `https://github.com/Ashwin-Baduni/${repo}`;

export const projects: { title: string; list: Project[] } = {
  title: "Projects",
  list: [
    {
      id: "motion",
      name: "Video motion amplification",
      year: "2023",
      award: "Smart India Hackathon 2023 winner",
      text: "Measures machine vibration from ordinary video so equipment can be checked for faults without fitting any sensors. Built for a Ministry of Defence problem statement.",
      tags: ["PyTorch", "OpenCV", "Optical flow", "Signal processing"],
      href: gh(
        "video-based-motion-amplification-and-vibration-analysis-SIH-2023",
      ),
    },
    {
      id: "analytics",
      name: "Analytics chatbot",
      year: "2025",
      text: "Ask a dataset questions in plain English and get back the query and a chart. It runs on quantized LLMs and was built during my time at NIC.",
      tags: ["FastAPI", "LLMs", "Text-to-SQL"],
      href: gh("AI-powered-analytics-dashboard-chatbot-2025"),
    },
    {
      id: "captcha",
      name: "CAPTCHA recognition from scratch",
      year: "2025",
      text: "A CNN encoder with an attention-based decoder that reads distorted text. It was trained entirely on generated data.",
      tags: ["PyTorch", "Seq2seq", "Attention"],
      href: gh("captcha-ocr-from-scratch-2025"),
    },
  ],
};

export const contact = {
  titleBefore: "Let's",
  titleMark: "talk.",
  text: "Get in touch about computer vision, AI agents, or a product you're building.",
};
