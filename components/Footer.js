import Image from "next/image";
import Link from "next/link";
const defaultLocales = ['fr', 'en','es'];
export default function Footer({lang = "fr" ,locales = defaultLocales,}) {
    
    return (
            <footer className="px-4 divide-y bg-gray-100 text-gray-800">
                <div className="container flex flex-col justify-between py-10 mx-auto space-y-8 lg:flex-row lg:space-y-0">
                    <div className="lg:w-1/3">
                        <a rel="noopener noreferrer" href="/" className="flex justify-center space-x-3 lg:justify-start">
                           <Image
                           src="/images/logo.png"
                           width={200}
                           height={200}
                           alt="logo dans le footer"
                           /> 
                        </a>
                    </div>
                    <div className="grid grid-cols-2 text-sm gap-x-3 gap-y-8 lg:w-2/3 sm:grid-cols-4">
                        <div className="space-y-3">
                            <h3 className="tracking-wide uppercase text-gray-900">Website</h3>
                            <ul className="space-y-1 ">
                                <li>
                                    <a rel="noopener hover:text-teal-500 noreferrer" href={`/${lang}/`}>Home</a>
                                </li>
                                <li>
                                    <a rel="noopener hover:text-teal-500 noreferrer" href={`/${lang}/blog`}>About</a>
                                </li>
                                <li>
                                    <a rel="noopener hover:text-teal-500 noreferrer" href={`/${lang}/location`}>Properties for rent</a>
                                </li>
                                <li>
                                    <a rel="noopener hover:text-teal-500 noreferrer" href={`/${lang}/contact`}>Contact</a>
                                </li>
                            </ul>
                        </div>
                        <div className="space-y-3">
                            <h3 className="tracking-wide uppercase text-gray-900">Company</h3>
                            <ul className="space-y-1">
                                <li>
                                    <a rel="noopener hover:text-teal-500 noreferrer" href={`/${lang}/cgv`}>cgv</a>
                                </li>
                                <li>
                                    <a rel="noopener hover:text-teal-500 noreferrer" href={`/${lang}/termofuse`}>Terms of Service</a>
                                </li>
                            </ul>
                        </div>
                        <div className="space-y-3">
                            <div className="uppercase text-gray-900">Social media</div>
                            <div className="flex justify-start space-x-3">
                                {/* Instagram */}
                                <a
                                rel="noopener  noreferrer"
                                href="https://www.instagram.com/expatlife.com_/"
                                title="Instagram"
                                className="flex items-center hover:text-teal-500 p-1"
                                >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 32 32"
                                    fill="currentColor"
                                    className="w-5 h-5 fill-current"
                                >
                                    <path d="M16 0c-4.349 0-4.891 0.021-6.593 0.093-1.709 0.084-2.865 0.349-3.885 0.745-1.052 0.412-1.948 0.959-2.833 1.849-0.891 0.885-1.443 1.781-1.849 2.833-0.396 1.020-0.661 2.176-0.745 3.885-0.077 1.703-0.093 2.244-0.093 6.593s0.021 4.891 0.093 6.593c0.084 1.704 0.349 2.865 0.745 3.885 0.412 1.052 0.959 1.948 1.849 2.833 0.885 0.891 1.781 1.443 2.833 1.849 1.020 0.391 2.181 0.661 3.885 0.745 1.703 0.077 2.244 0.093 6.593 0.093s4.891-0.021 6.593-0.093c1.704-0.084 2.865-0.355 3.885-0.745 1.052-0.412 1.948-0.959 2.833-1.849 0.891-0.885 1.443-1.776 1.849-2.833 0.391-1.020 0.661-2.181 0.745-3.885 0.077-1.703 0.093-2.244 0.093-6.593s-0.021-4.891-0.093-6.593c-0.084-1.704-0.355-2.871-0.745-3.885-0.412-1.052-0.959-1.948-1.849-2.833-0.885-0.891-1.776-1.443-2.833-1.849-1.020-0.396-2.181-0.661-3.885-0.745-1.703-0.077-2.244-0.093-6.593-0.093zM16 2.88c4.271 0 4.781 0.021 6.469 0.093 1.557 0.073 2.405 0.333 2.968 0.553 0.751 0.291 1.276 0.635 1.844 1.197 0.557 0.557 0.901 1.088 1.192 1.839 0.22 0.563 0.48 1.411 0.553 2.968 0.072 1.688 0.093 2.199 0.093 6.469s-0.021 4.781-0.099 6.469c-0.084 1.557-0.344 2.405-0.563 2.968-0.303 0.751-0.641 1.276-1.199 1.844-0.563 0.557-1.099 0.901-1.844 1.192-0.556 0.22-1.416 0.48-2.979 0.553-1.697 0.072-2.197 0.093-6.479 0.093s-4.781-0.021-6.48-0.099c-1.557-0.084-2.416-0.344-2.979-0.563-0.76-0.303-1.281-0.641-1.839-1.199-0.563-0.563-0.921-1.099-1.197-1.844-0.224-0.556-0.48-1.416-0.563-2.979-0.057-1.677-0.084-2.197-0.084-6.459 0-4.26 0.027-4.781 0.084-6.479 0.083-1.563 0.339-2.421 0.563-2.979 0.276-0.761 0.635-1.281 1.197-1.844 0.557-0.557 1.079-0.917 1.839-1.199 0.563-0.219 1.401-0.479 2.964-0.557 1.697-0.061 2.197-0.083 6.473-0.083zM16 7.787c-4.541 0-8.213 3.677-8.213 8.213 0 4.541 3.677 8.213 8.213 8.213 4.541 0 8.213-3.677 8.213-8.213 0-4.541-3.677-8.213-8.213-8.213zM16 21.333c-2.948 0-5.333-2.385-5.333-5.333s2.385-5.333 5.333-5.333c2.948 0 5.333 2.385 5.333 5.333s-2.385 5.333-5.333 5.333zM26.464 7.459c0 1.063-0.865 1.921-1.923 1.921-1.063 0-1.921-0.859-1.921-1.921 0-1.057 0.864-1.917 1.921-1.917s1.923 0.86 1.923 1.917z"></path>
                                </svg>
                                </a>

                                {/* WhatsApp */}
                                <a
                                rel="noopener noreferrer"
                                href="https://wa.me/971568127898"
                                title="WhatsApp"
                                className="flex items-center hover:text-teal-500 p-1"
                                >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 32 32"
                                    fill="currentColor"
                                    className="w-5 h-5 fill-current"
                                >
                                    <path d="M16 0c-8.837 0-16 7.163-16 16 0 3.151 0.925 6.111 2.502 8.576l-2.533 7.456 7.773-2.442c2.383 1.424 5.118 2.37 8.258 2.37 8.837 0 16-7.163 16-16s-7.163-16-16-16zM16 29.119c-2.76 0-5.334-0.824-7.48-2.224l-5.324 1.671 1.65-5.348c-1.499-2.106-2.403-4.684-2.403-7.218 0-7.732 6.268-14 14-14 7.732 0 14 6.268 14 14 0 7.732-6.268 14-14 14zM22.335 19.75c-0.216-0.108-1.273-0.63-1.471-0.703-0.199-0.072-0.342-0.108-0.484 0.108-0.144 0.216-0.556 0.703-0.681 0.847-0.125 0.144-0.252 0.162-0.468 0.054-0.216-0.108-0.911-0.335-1.733-1.069-0.641-0.551-1.075-1.231-1.203-1.448-0.125-0.216-0.013-0.332 0.094-0.434 0.097-0.096 0.216-0.252 0.324-0.377 0.108-0.125 0.144-0.216 0.216-0.36 0.072-0.144 0.036-0.27-0.018-0.377-0.054-0.108-0.484-1.167-0.667-1.607-0.175-0.423-0.354-0.367-0.484-0.367-0.125 0-0.27-0.018-0.414-0.018-0.144 0-0.377 0.054-0.576 0.27-0.198 0.216-0.756 0.738-0.756 1.804 0 1.066 0.774 2.094 0.881 2.238 0.108 0.144 1.514 2.413 3.677 3.388 0.515 0.223 0.916 0.355 1.228 0.455 0.515 0.162 0.983 0.139 1.353 0.083 0.412-0.067 1.273-0.521 1.452-1.025 0.18-0.505 0.18-0.939 0.126-1.025-0.054-0.083-0.198-0.126-0.414-0.234z"></path>
                                </svg>
                                </a>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h3 className="uppercase text-gray-900">ExpatLife</h3>
                            <ul className="space-y-1">
                                <li>
                                    <a rel="noopener noreferrer" href="#">meydan, Dubai</a>
                                </li>
                                <li>
                                    <a rel="noopener noreferrer" className=" hover:text-teal-500" href="mailto:contact@expatlife-uae.com">Contact@expatlife-uae.com</a>
                                </li>
                                
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="py-6 text-sm text-center text-gray-600">© Made with ❤️ By <Link href={"https://ugm-communication.com"} className="underline hover:text-teal-500" >UGM LLC</Link> All rights reserved. v1.0</div>
            </footer>
  );
}