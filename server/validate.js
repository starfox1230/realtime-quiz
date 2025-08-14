export function validateQuiz(quiz){
  if (!quiz || typeof quiz !== "object") return { valid: false, error: "Quiz payload missing" };
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 1) return { valid: false, error: "Quiz needs at least one question" };
  for (let i=0; i<quiz.questions.length; i++){
    const q = quiz.questions[i];
    if (!q || typeof q !== "object") return { valid:false, error:`Question ${i} invalid` };
    if (typeof q.prompt !== "string" || !Array.isArray(q.choices)) return { valid:false, error:`Question ${i} missing prompt/choices` };
    if (q.choices.length < 2 || q.choices.length > 6) return { valid:false, error:`Question ${i} must have 2-6 choices` };
    if (typeof q.answerIndex !== "number" || q.answerIndex < 0 || q.answerIndex >= q.choices.length){
      return { valid:false, error:`Question ${i} has invalid answerIndex` };
    }
  }
  return { valid: true };
}
