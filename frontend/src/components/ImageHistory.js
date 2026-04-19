import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getJson } from '../utils/api';
import '../styles/ImageHistory.css';

const getImageId = (image) => image?._id || image?.id;

const normalizeImage = (image = {}) => ({
  ...image,
  _id: getImageId(image),
  ratio: image.ratio || '1:1',
  quality: image.quality || 'balanced',
});

const ImageHistory = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalMessage, setModalMessage] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isActive = true;

    const loadHistory = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await getJson(`/api/image/history?page=${page}&limit=6`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!isActive) {
          return;
        }

        setImages((data.images || []).map(normalizeImage));
        setTotalPages(data.pages || 1);
      } catch (err) {
        if (isActive) {
          setError(err.message || 'Failed to load history');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      isActive = false;
    };
  }, [token, page]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedImage(null);
        setModalMessage('');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const openImageModal = (image) => {
    setSelectedImage(normalizeImage(image));
    setModalMessage('');
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setModalMessage('');
  };

  const handleDownloadImage = (image) => {
    if (!image?.imageUrl) return;

    const link = document.createElement('a');
    link.href = image.imageUrl;
    link.download = `history-image-${Date.now()}.jpg`;
    link.click();
  };

  const handleRegenerateImage = async () => {
    if (!selectedImage || !token) return;

    setRegenerating(true);
    setModalMessage('');

    try {
      const data = await getJson('/api/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: selectedImage.prompt,
          ratio: selectedImage.ratio,
          quality: selectedImage.quality,
        }),
      });

      const nextImage = normalizeImage({
        ...data.image,
        _id: data.image.id,
      });

      setImages((currentImages) => [nextImage, ...currentImages]);
      setSelectedImage(nextImage);
      setModalMessage('Image regenerated successfully.');
    } catch (err) {
      setModalMessage(err.message || 'Could not regenerate image');
    } finally {
      setRegenerating(false);
    }
  };

  const handlePublishImage = async () => {
    if (!selectedImage || !token) return;

    setPublishing(true);
    setModalMessage('');

    try {
      await getJson('/api/gallery/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: (selectedImage.prompt || 'Generated image').slice(0, 120),
          description: selectedImage.prompt || '',
          prompt: selectedImage.prompt || '',
          imageUrl: selectedImage.imageUrl,
          source: 'generated',
        }),
      });

      setModalMessage('Image published to Explore!');
    } catch (err) {
      setModalMessage(err.message || 'Could not publish image');
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;

    try {
      await getJson(`/api/image/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      setImages((currentImages) => currentImages.filter((img) => getImageId(img) !== imageId));

      if (getImageId(selectedImage) === imageId) {
        closeImageModal();
      }
    } catch (err) {
      alert('Failed to delete image');
    }
  };

  if (loading) {
    return <div className="history-loading">Loading your history...</div>;
  }

  return (
    <div className="image-history">
      <h2>Your Image History</h2>

      {error && <div className="error-message">{error}</div>}

      {images.length === 0 ? (
        <div className="empty-state">
          <p>No images yet. Start creating to see your history here!</p>
        </div>
      ) : (
        <>
          <div className="history-grid">
            {images.map((image) => (
              <div
                key={getImageId(image)}
                className="history-card"
                onClick={() => openImageModal(image)}
              >
                <img src={image.imageUrl} alt={image.prompt} />
                <div className="card-overlay">
                  <p className="card-prompt">{image.prompt}</p>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteImage(getImageId(image));
                    }}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((currentPage) => currentPage - 1)}
              >
                Previous
              </button>
              <span>{page} of {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedImage && (
        <div className="image-modal" onClick={closeImageModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeImageModal} aria-label="Close preview">
              ×
            </button>
            <img src={selectedImage.imageUrl} alt={selectedImage.prompt} />
            <p className="modal-prompt">{selectedImage.prompt}</p>
            <div className="modal-meta">
              <span>Ratio: {selectedImage.ratio}</span>
              <span>Quality: {selectedImage.quality}</span>
            </div>
            <div className="modal-actions">
              <button onClick={() => handleDownloadImage(selectedImage)}>
                Download
              </button>
              <button onClick={handleRegenerateImage} disabled={regenerating}>
                {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button onClick={handlePublishImage} disabled={publishing}>
                {publishing ? 'Publishing...' : 'Publish to Explore'}
              </button>
              <button
                className="delete-btn"
                onClick={() => handleDeleteImage(getImageId(selectedImage))}
              >
                Delete
              </button>
            </div>
            {modalMessage && <div className="modal-message">{modalMessage}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageHistory;
