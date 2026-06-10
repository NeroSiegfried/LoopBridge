import { Link } from 'react-router-dom';

export default function CourseCard({ course, progress }) {
  const authorName = course.author
    ? (typeof course.author === 'string' ? course.author : course.author.name || 'LoopBridge Team')
    : 'LoopBridge Team';

  const topicCount = course.topics ? course.topics.length : 0;
  const isComplete = progress && progress.progressPct >= 100;

  return (
    <Link to={`/courses/${course.id}`} className="course-card-link">
      <div className="course-container">
        <div className="course-card">
          <div className="course-image">
            <div className={`course-price${course.price ? ' paid' : ''}`}>
              {course.price ? `$${course.price}` : 'Free'}
            </div>
            {course.image && <img src={course.image} alt={course.title} />}
          </div>
          <div className="course-body">
            <div className="main-text">
              <h3 className="course-title">{course.title}</h3>
              <p className="course-description">{course.description}</p>
            </div>
            {progress && (
              <div className={`course-progress-bar${isComplete ? ' completed' : ''}`}>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress.progressPct}%` }} />
                </div>
                <span className="progress-label">{isComplete ? 'Done' : `${progress.progressPct}%`}</span>
              </div>
            )}
            <p className="course-author">By {authorName}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
