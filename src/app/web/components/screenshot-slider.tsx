import React from "react";
import Slider from "react-slick";
import { Image } from "@heroui/react";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
export default function ScreenshotSlider() {
    var settings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 4,
        slidesToScroll: 1,
    };
    return (
        <>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <span className="font-extrabold flashing-text" style={{ fontSize: "24px", color: "#ff5722" }}>
                    Try our mobile app!! Available only for Android
                </span>
            </div>
            <Slider {...settings}>
                <div>
                    <Image src="mobile/app-1.png" width={300} height={500} />
                </div>
                <div>
                    <Image src="mobile/app-2.png" width={300} height={500} />
                </div>
                <div>
                    <Image src="mobile/app-3.png" width={300} height={500} />
                </div>
                <div>
                    <Image src="mobile/app-4.png" width={300} height={500} />
                </div>
                <div>
                    <Image src="mobile/app-5.png" width={300} height={500} />
                </div>
                <div>
                    <Image src="mobile/app-6.png" width={300} height={500} />
                </div>
                <div>
                    <Image src="mobile/app-7.png" width={300} height={500} />
                </div>
            </Slider>
        </>
    );
}