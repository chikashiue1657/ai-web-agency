import type { Metadata } from "next";
import CadApp from "./CadApp";

export const metadata: Metadata = {
  title: "衣料品レイアウトCAD",
  description: "型紙を生地シート上に配置して裁断レイアウトを検討する個人用CADツール",
};

export default function ClothingCadPage() {
  return <CadApp />;
}
