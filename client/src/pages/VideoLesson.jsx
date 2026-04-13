import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { coursesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../hooks/useAnalytics';
import '../styles/lesson.css';

/**
 * VideoLesson — plays a video with optional inline quiz pause-points.
 *
 * URL: /courses/:courseId/lessons/:topicIdx/:subIdx
 *
 * Data shape from course.topics[topicIdx].subsections[subIdx]:
 *   { title, type: "video", duration, videoUrl?,
 *     quizPoints?: [{ atSeconds: 120, questions: [...] }],
 *     content?: [ { type: "text"|"heading"|"image"|"code"|"note", value } ]
 *   }
 *
 * The quiz pause-points pause the video and show a quiz overlay.
 * The user must pass (≥70%) to continue. On fail, they can retry.
 */
export default function VideoLesson() {
  const { courseId, topicIdx, subIdx } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [activeQuiz, setActiveQuiz] = useState(null); // { questions, atSeconds, pointIdx }
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null); // { score, passed }
  const [completedQuizPoints, setCompletedQuizPoints] = useState(new Set());

  const videoRef = useRef(null);
  const timeCheckRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    coursesApi.get(courseId)
      .then(setCourse)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const topic = course?.topics?.[Number(topicIdx)];
  const sub = topic?.subsections?.[Number(subIdx)];
  const quizPoints = sub?.quizPoints || [];

  // Track lesson start
  useEffect(() => {
    if (sub) {
      trackEvent('lesson_start', {
        courseId,
        metadata: { topicIdx, subIdx, title: sub.title, type: 'video' },
        userId: user?.id,
      });
    }
  }, [courseId, topicIdx, subIdx, sub?.title]); // eslint-disable-line

  // Monitor video time for quiz pause-points
  useEffect(() => {
    const video = videoRef.current;
    if (!video || quizPoints.length === 0) return;

    const onTimeUpdate = () => {
      const currentTime = video.currentTime;
      for (let i = 0; i < quizPoints.length; i++) {
        const point = quizPoints[i];
        if (
          !completedQuizPoints.has(i) &&
          currentTime >= point.atSeconds &&
          currentTime < point.atSeconds + 1.5
        ) {
          video.pause();
          setActiveQuiz({ ...point, pointIdx: i });
          setAnswers({});
          setQuizResult(null);
          trackEvent('quiz_start', {
            courseId,
            quizId: `${courseId}-${topicIdx}-${subIdx}-qp${i}`,
            userId: user?.id,
          });
          break;
        }
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    timeCheckRef.current = onTimeUpdate;
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [quizPoints, completedQuizPoints, courseId, topicIdx, subIdx, user?.id]);

  const handleAnswer = (qIdx, optionIdx) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz) return;
    const { questions, pointIdx } = activeQuiz;
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= 70;

    setQuizResult({ score, passed, correct, total: questions.length });
    trackEvent('quiz_submit', {
      courseId,
      quizId: `${courseId}-${topicIdx}-${subIdx}-qp${pointIdx}`,
      score,
      userId: user?.id,
      metadata: { passed, correct, total: questions.length },
    });

    if (passed) {
      setCompletedQuizPoints((prev) => new Set([...prev, pointIdx]));
    }
  };

  const handleRetryQuiz = () => {
    setAnswers({});
    setQuizResult(null);
    trackEvent('quiz_retry', {
      courseId,
      quizId: `${courseId}-${topicIdx}-${subIdx}-qp${activeQuiz?.pointIdx}`,
      userId: user?.id,
    });
  };

  const handleContinueAfterQuiz = () => {
    setActiveQuiz(null);
    setQuizResult(null);
    setAnswers({});
    videoRef.current?.play();
  };

  const handleVideoEnd = () => {
    trackEvent('lesson_complete', {
      courseId,
      metadata: { topicIdx, subIdx, title: sub?.title, type: 'video' },
      userId: user?.id,
    });
    // Mark progress
    if (user && sub) {
      coursesApi.updateProgress(courseId, `${topicIdx}-${subIdx}`, true).catch(() => {});
    }
  };

  // Navigation helpers
  const totalSubs = topic?.subsections?.length || 0;
  const currentSubIdx = Number(subIdx);
  const currentTopicIdx = Number(topicIdx);
  const totalTopics = course?.topics?.length || 0;

  const getNextLesson = useCallback(() => {
    if (currentSubIdx + 1 < totalSubs) {
      return `/courses/${courseId}/lessons/${currentTopicIdx}/${currentSubIdx + 1}`;
    }
    if (currentTopicIdx + 1 < totalTopics) {
      return `/courses/${courseId}/lessons/${currentTopicIdx + 1}/0`;
    }
    return null;
  }, [courseId, currentSubIdx, currentTopicIdx, totalSubs, totalTopics]);

  const getPrevLesson = useCallback(() => {
    if (currentSubIdx > 0) {
      return `/courses/${courseId}/lessons/${currentTopicIdx}/${currentSubIdx - 1}`;
    }
    if (currentTopicIdx > 0) {
      const prevTopic = course?.topics?.[currentTopicIdx - 1];
      const prevSubCount = prevTopic?.subsections?.length || 1;
      return `/courses/${courseId}/lessons/${currentTopicIdx - 1}/${prevSubCount - 1}`;
    }
    return null;
  }, [course, courseId, currentSubIdx, currentTopicIdx]);

  if (loading) {
    return (
      <section className="lesson-section">
        <div className="section-container"><p className="lesson-loading">Loading lesson…</p></div>
      </section>
    );
  }

  if (!course || !topic || !sub) {
    return (
      <section className="lesson-section">
        <div className="section-container">
          <p className="lesson-error">Lesson not found.</p>
          <Link to={`/courses/${courseId}`} className="lesson-back">
            <i className="fa-solid fa-angle-left" /> Back to course
          </Link>
        </div>
      </section>
    );
  }

  const prevUrl = getPrevLesson();
  const nextUrl = getNextLesson();

  return (
    <>
      <SEO
        title={`${sub.title} — ${course.title} — LoopBridge Academy`}
        description={`Watch: ${sub.title}`}
      />

      <section className="lesson-section">
        {/* Back button */}
        <div className="section-container">
          <Link to={`/courses/${courseId}`} className="lesson-back">
            <i className="fa-solid fa-angle-left" /> {course.title}
          </Link>
        </div>

        <div className="lesson-container">
          {/* Video player */}
          <div className="video-wrapper">
            {sub.videoUrl ? (
              <video
                ref={videoRef}
                src={sub.videoUrl}
                controls
                onEnded={handleVideoEnd}
                className="lesson-video"
              />
            ) : (
              <div className="video-placeholder">
                <i className="fa-solid fa-video" />
                <p>Video coming soon</p>
                <p className="placeholder-sub">This lesson's video content is being prepared.</p>
              </div>
            )}

            {/* Quiz overlay */}
            {activeQuiz && (
              <div className="quiz-overlay">
                <div className="quiz-card">
                  <div className="quiz-header">
                    <i className="fa-solid fa-clipboard-list" />
                    <h3>Quick Check</h3>
                    <p>Answer correctly to continue (70% to pass)</p>
                  </div>

                  {!quizResult ? (
                    <div className="quiz-body">
                      {activeQuiz.questions.map((q, qIdx) => (
                        <div className="quiz-question" key={qIdx}>
                          <p className="question-text">{qIdx + 1}. {q.question}</p>
                          <div className="question-options">
                            {q.options.map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                className={`option-btn${answers[qIdx] === oIdx ? ' selected' : ''}`}
                                onClick={() => handleAnswer(qIdx, oIdx)}
                              >
                                <span className="option-letter">{String.fromCharCode(65 + oIdx)}</span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        className="quiz-submit-btn"
                        onClick={handleSubmitQuiz}
                        disabled={Object.keys(answers).length < activeQuiz.questions.length}
                      >
                        Submit Answers
                      </button>
                    </div>
                  ) : (
                    <div className="quiz-result">
                      <div className={`result-badge ${quizResult.passed ? 'passed' : 'failed'}`}>
                        <i className={`fa-solid ${quizResult.passed ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                        <span>{quizResult.score}%</span>
                      </div>
                      <p className="result-text">
                        {quizResult.passed
                          ? `Great job! You got ${quizResult.correct}/${quizResult.total} correct.`
                          : `You got ${quizResult.correct}/${quizResult.total}. You need 70% to continue.`}
                      </p>
                      {quizResult.passed ? (
                        <button className="quiz-continue-btn" onClick={handleContinueAfterQuiz}>
                          Continue Video <i className="fa-solid fa-arrow-right" />
                        </button>
                      ) : (
                        <button className="quiz-retry-btn" onClick={handleRetryQuiz}>
                          <i className="fa-solid fa-rotate-left" /> Try Again
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lesson info */}
          <div className="lesson-info">
            <h1 className="lesson-title">{sub.title}</h1>
            <div className="lesson-meta">
              {sub.duration && <span><i className="fa-solid fa-clock" /> {sub.duration}</span>}
              <span><i className="fa-solid fa-signal" /> {topic.title}</span>
              {sub.type && <span className="lesson-type-badge video-badge"><i className="fa-solid fa-video" /> Video</span>}
            </div>
          </div>

          {/* Supplementary text/content below the video */}
          {sub.content && sub.content.length > 0 && (
            <div className="lesson-content">
              <h2>Lesson Notes</h2>
              {sub.content.map((block, i) => {
                switch (block.type) {
                  case 'heading':
                    return <h3 key={i}>{block.value}</h3>;
                  case 'text':
                    return <p key={i}>{block.value}</p>;
                  case 'image':
                    return <img key={i} src={block.value} alt={block.alt || ''} className="lesson-content-img" />;
                  case 'code':
                    return <pre key={i} className="lesson-code"><code>{block.value}</code></pre>;
                  case 'note':
                    return (
                      <div key={i} className="lesson-note">
                        <i className="fa-solid fa-lightbulb" />
                        <p>{block.value}</p>
                      </div>
                    );
                  default:
                    return <p key={i}>{block.value}</p>;
                }
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="lesson-nav">
            {prevUrl ? (
              <Link to={prevUrl} className="lesson-nav-btn prev">
                <i className="fa-solid fa-arrow-left" /> Previous Lesson
              </Link>
            ) : <div />}
            {nextUrl ? (
              <Link to={nextUrl} className="lesson-nav-btn next">
                Next Lesson <i className="fa-solid fa-arrow-right" />
              </Link>
            ) : (
              <Link to={`/courses/${courseId}`} className="lesson-nav-btn next complete">
                Back to Course <i className="fa-solid fa-flag-checkered" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
