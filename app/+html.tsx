import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function will be rendered in the <head> of the HTML document.
export default function Root({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, shrink-to-fit=no"
                />

                {/* 
          This disables the extra scrollbar that can appear on some devices. 
        */}
                <ScrollViewStyleReset />

                {/* Preload Ionicons font */}
                <link
                    rel="preload"
                    href="https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.1.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"
                    as="font"
                    type="font/ttf"
                    crossOrigin="anonymous"
                />
                {/* Preload MaterialIcons font */}
                <link
                    rel="preload"
                    href="https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.1.0/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf"
                    as="font"
                    type="font/ttf"
                    crossOrigin="anonymous"
                />
                <style dangerouslySetInnerHTML={{
                    __html: `
            @font-face {
                font-family: 'Ionicons';
                src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.1.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
                font-display: swap;
            }
            @font-face {
                font-family: 'Material Icons';
                src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.1.0/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf') format('truetype');
                font-display: swap;
            }
            @font-face {
                font-family: 'MaterialIcons';
                src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.1.0/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf') format('truetype');
                font-display: swap;
            }
            body {
                background-color: #0f0a1e;
            }
        `}} />
            </head>
            <body>{children}</body>
        </html>
    );
}
