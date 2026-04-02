import CharacterView01 from "./_components/CharacterView01";
import CharacterView02 from "./_components/CharacterView02";

export default function Home() {
  return (
    <div className="flex h-full">
      <CharacterView01 />
      <CharacterView02 />
    </div>
  );
}
