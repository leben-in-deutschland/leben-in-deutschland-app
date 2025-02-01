"use-client";

import { Card, CardBody, CardHeader, Link, Alert } from "@heroui/react";

export default function PrivacyPolicy() {
    return (
        <Card className="flex flex-col items-center justify-center gap-8 py-8 md:py-12 lg:py-16">
            <CardHeader className="flex flex-col text-center text-3xl font-bold text-gray-800 dark:text-white">
                <span><span className="text-indigo-600">lebenindeutschland.org / Einbürgerungstest (No Ads) </span>Privacy Notice</span>
                <div className="mt-2 text-lg text-gray-500">Last updated January 30, 2025</div>
            </CardHeader>
            <div className="w-full md:w-3/4 lg:w-1/2 px-6 py-4 rounded-lg shadow-md mb-8 text-center">
                <Alert color="warning" title="Note: This is not an official Einbürgerungstest. This platform is designed to help you prepare for the Einbürgerungstest." />
                <Alert color="danger" title="This website is a private offering and not an official site of the Federal Office for Migration and Refugees (BAMF). The Einbürgerungstest can only be carried out at the BAMF." />

                <h2 className="text-xl font-semibold mb-4">Table of Contents</h2>
                <ul className="space-y-2">
                    <li><a href="#intro" className="text-blue-600 hover:underline">1. Introduction</a></li>
                    <li><a href="#info-collection" className="text-blue-600 hover:underline">2. Information We Collect</a></li>
                    <li><a href="#data-ownership" className="text-blue-600 hover:underline">3. Data Ownership & Control</a></li>
                    <li><a href="#third-party" className="text-blue-600 hover:underline">4. Third-Party Services</a></li>
                    <li><a href="#changes" className="text-blue-600 hover:underline">5. Changes to This Privacy Policy</a></li>
                    <li><a href="#contact" className="text-blue-600 hover:underline">6. Contact Us</a></li>
                </ul>
            </div>

            <CardBody className="flex flex-col gap-8">
                <Card id="intro" className="shadow-md rounded-lg">
                    <CardHeader className="bg-indigo-600 text-white py-3 rounded-t-lg">
                        <h3 className="text-xl font-semibold">1. Introduction</h3>
                    </CardHeader>
                    <div className="p-6">
                        <p>Thank you for choosing to be part of our community at bitesinbyte, doing business as lebenindeutschland.org/Einbürgerungstest (No Ads) (&quot;lebenindeutschland,Einbürgerungstest (No Ads)&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We are committed to protecting your personal information and respecting your right to privacy. If you have any questions or concerns about this privacy notice or our practices regarding your personal information, please contact us at hello@bitesinbyte.com.</p>
                    </div>
                </Card>
                <Card id="info-collection" className="shadow-md rounded-lg">
                    <CardHeader className="bg-indigo-600 text-white py-3 rounded-t-lg">
                        <h3 className="text-xl font-semibold">2. Information We Collect</h3>
                    </CardHeader>
                    <div className="p-6">
                        <p>This privacy notice explains how we handle your information if you:</p>
                        <ul className="list-inside list-disc pl-6">
                            <li>Download and use our mobile application — Einbürgerungstest (No Ads)</li>
                            <li>Use our web application — lebenindeutschland.org</li>
                            <li>Interact with us in other ways, including sales, marketing, or events.</li>
                        </ul>
                        <p>When we refer to:</p>
                        <ul className="list-inside list-disc pl-6">
                            <li>&quot;App,&quot; we mean any application we own or operate that links to this privacy policy, including the one mentioned above.</li>
                            <li>&quot;Services,&quot; we mean the App and any associated services, including sales, marketing, or events.</li>
                        </ul>
                        <p>This notice is designed to clearly explain what data we may collect, how we use it, and what rights you have regarding your information. If you disagree with any terms in this privacy policy, please stop using our Services immediately.</p>
                    </div>
                </Card>
                <Card id="data-ownership" className="shadow-md rounded-lg">
                    <CardHeader className="bg-indigo-600 text-white py-3 rounded-t-lg">
                        <h3 className="text-xl font-semibold">3. Data Ownership & Control</h3>
                    </CardHeader>
                    <div className="p-6">
                        <p>At lebenindeutschland, we do not collect, store, or share any personal information. We do not require any personal data for you to use our app. There are no forms to fill out, no accounts to create, and no data collection mechanisms in place. Your privacy is paramount, and as such, we do not use cookies, tracking technologies, or third-party services like Google Analytics to collect or monitor your activities.</p>
                    </div>
                </Card>
                <Card id="third-party" className="shadow-md rounded-lg">
                    <CardHeader className="bg-indigo-600 text-white py-3 rounded-t-lg">
                        <h3 className="text-xl font-semibold">4. Third-Party Services</h3>
                    </CardHeader>
                    <div className="p-6">
                        <p>We do not share your data with any third parties. Our app does not interact with or send data to any external services. We do not use third-party analytics, advertising networks, or tracking systems of any kind. Your data remains private and secure in your hands only.</p>
                    </div>
                </Card>

                <Card id="changes" className="shadow-md rounded-lg">
                    <CardHeader className="bg-indigo-600 text-white py-3 rounded-t-lg">
                        <h3 className="text-xl font-semibold">5. Changes to This Privacy Policy</h3>
                    </CardHeader>
                    <div className="p-6">
                        <p>We reserve the right to update this privacy policy from time to time. If we make any changes, we will post the updated policy on this page with an updated &quot;Last Updated&quot; date. We encourage you to review this privacy policy periodically to stay informed about how we are protecting your privacy. Any updates will be effective as soon as they are posted, and by continuing to use our Services, you agree to the revised policy.</p>
                    </div>
                </Card>
                <Card id="contact" className="shadow-md rounded-lg">
                    <CardHeader className="bg-indigo-600 text-white py-3 rounded-t-lg">
                        <h3 className="text-xl font-semibold">6. Contact Us</h3>
                    </CardHeader>
                    <div className="p-6">
                        <p>If you have any questions about this privacy policy or our practices, or if you wish to exercise any of your rights regarding your data, please feel free to contact us at hello@bitesinbyte.com. We will respond to your inquiries in a timely manner.</p>
                    </div>
                </Card>
            </CardBody>
        </Card>
    );
};
