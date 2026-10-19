import SmoothScroll from "@/components/SmoothScroll";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Journey from "@/components/Journey";
import Menu from "@/components/Menu";
import Shop from "@/components/Shop";
import Gallery from "@/components/Gallery";
import Locations from "@/components/Locations";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <Nav />
      <main>
        <Hero />
        <Journey />
        <Menu />
        <Shop />
        <Gallery />
        <Locations />
      </main>
      <Footer />
    </>
  );
}
