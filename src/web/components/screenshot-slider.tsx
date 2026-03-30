import React from "react";
import Slider from "react-slick";
import { Image } from "@heroui/react";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function ScreenshotSlider({ title }: { title: string }) {
    const settings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 4,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        pauseOnHover: true,
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 3,
                    slidesToScroll: 1,
                },
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2,
                    slidesToScroll: 1,
                },
            },
            {
                breakpoint: 480,
                settings: {
                    slidesToShow: 1,
                    slidesToScroll: 1,
                    centerMode: true,
                    centerPadding: "32px",
                },
            },
        ],
    };

    const screenshots = [
        { alt: "Leben in Deutschland App - Dashboard Übersicht", src: "mobile/app-1.png" },
        { alt: "Einbürgerungstest Übungsfragen in der App", src: "mobile/app-2.png" },
        { alt: "Probeprüfung Ansicht mit Timer", src: "mobile/app-3.png" },
        { alt: "Fortschritts-Statistiken und Diagramme", src: "mobile/app-4.png" },
        { alt: "Fragenkatalog nach Kategorien", src: "mobile/app-5.png" },
        { alt: "Prüfungsbereitschaft Anzeige", src: "mobile/app-6.png" },
        { alt: "Einstellungen und Bundesland-Auswahl", src: "mobile/app-7.png" },
    ];

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {title}
                </h2>
            </div>
            <Slider {...settings}>
                {screenshots.map((img, i) => (
                    <div key={i} className="px-1 sm:px-2">
                        <Image
                            alt={img.alt}
                            src={img.src}
                            className="rounded-xl mx-auto"
                            width={280}
                            height={500}
                        />
                    </div>
                ))}
            </Slider>
        </div>
    );
}
