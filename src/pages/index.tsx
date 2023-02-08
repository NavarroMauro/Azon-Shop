import Head from "next/head";
import { FeaturedList } from "../components/FeaturedList";
import { HeroSection } from "../components/HeroSection";
import { api } from "../utils/api";

import { type NextPage } from "next";

const Home: NextPage = () => {
  const featuredProd = api.product.getAll.useQuery(20);

  return (
    <>
      <Head>
        <title>Azon</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <HeroSection />

      <div className="px-4">
        <FeaturedList items={featuredProd.data} />
      </div>
    </>
  );
};

export default Home;
