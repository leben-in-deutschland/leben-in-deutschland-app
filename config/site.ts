export type SiteConfig = typeof siteConfig;

export const siteConfig = {
    name: "Leben in Deutschland",
    description: "Action Watcher is a tool to help you find and fix security vulnerabilities in your open source dependencies.",
    navItems: [
        {
            label: "Home",
            href: "/",
        },
        {
            label: "Blog",
            href: "https://blogs.bitesinbyte.com/",
        },
        {
            label: "Tools",
            href: "https://tools.bitesinbyte.com/",
        },
        {
            label: "Edmx Tools",
            href: "https://edmx.bitesinbyte.com/",
        }
    ],
    navMenuItems: [
    ],
    links: {
        github: "https://github.com/bitesinbyte",
        bitesinbyte: "https://links.bitesinbyte.com/",
        sponsor: "https://ko-fi.com/bitesinbyte"
    }
};