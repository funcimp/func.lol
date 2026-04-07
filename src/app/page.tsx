import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="flex flex-col items-center text-center space-y-6">
        <Image
          src="/funcimp.svg"
          alt="func imp"
          width={220}
          height={194}
          priority
        />
        <p className="opacity-70 max-w-md">
          Lab experiments by Functionally Imperative. Coming soon.
        </p>
      </div>
    </main>
  );
}
