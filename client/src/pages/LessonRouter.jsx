import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { coursesApi } from '../api';
import VideoLesson from './VideoLesson';
import ReadingLesson from './ReadingLesson';

/**
 * LessonRouter — fetches course data and renders the correct lesson component
 * based on subsection.type ("video" | "reading" | "quiz").
 *
 * Quiz-type subsections are shown as reading lessons with just the quiz.
 */
export default function LessonRouter() {
  const { courseId, topicIdx, subIdx } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    coursesApi.get(courseId)
      .then(setCourse)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <section className="lesson-section">
        <div className="section-container"><p className="lesson-loading">Loading…</p></div>
      </section>
    );
  }

  const topic = course?.topics?.[Number(topicIdx)];
  const sub = topic?.subsections?.[Number(subIdx)];
  const type = sub?.type || 'video';

  if (type === 'reading' || type === 'quiz') {
    return <ReadingLesson />;
  }

  // Default: video
  return <VideoLesson />;
}
