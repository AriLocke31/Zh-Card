import { Alert } from "@mui/material";
import { useParams } from "react-router-dom";
import Article from "../components/Article";
import { articles } from "../data/articles";

export default function ArticlePage() {
  const { id } = useParams();
  const article = articles.find(article => article.id === id);
  return <>
    {article ? <Article key={article.id} article={article} /> : <Alert severity="info">Article not found.</Alert>}
  </>;
}
