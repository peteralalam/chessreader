import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, TextLayer, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { saveSession, loadSession } from './db';

GlobalWorkerOptions.workerSrc = pdfWorker;

function App()
{
  const sendGtagEvent = (action, params = {}) =>
  {
    try
    {
      if (typeof window !== 'undefined' && window.gtag)
      {
        window.gtag('event', action, params);
      }
    } catch (e)
    {
      // ignore
    }
  };

  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const textLayerTaskRef = useRef(null);
  const pdfScrollRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [isRendering, setIsRendering] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [jumpPage, setJumpPage] = useState('');

  useEffect(() =>
  {
    let isCancelled = false;

    const renderPdfPage = async () =>
    {
      if (!pdfDoc || !canvasRef.current || !textLayerRef.current)
      {
        return;
      }

      if (renderTaskRef.current)
      {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (textLayerTaskRef.current)
      {
        textLayerTaskRef.current.cancel();
        textLayerTaskRef.current = null;
      }

      setIsRendering(true);
      setPdfError('');

      try
      {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled)
        {
          return;
        }

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const textLayerContainer = textLayerRef.current;

        if (!context || !textLayerContainer)
        {
          return;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        textLayerContainer.replaceChildren();
        textLayerContainer.style.width = `${viewport.width}px`;
        textLayerContainer.style.height = `${viewport.height}px`;

        const canvasRenderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = canvasRenderTask;

        const textContent = await page.getTextContent();
        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerContainer,
          viewport,
        });
        textLayerTaskRef.current = textLayer;

        await Promise.all([canvasRenderTask.promise, textLayer.render()]);
      } catch (error)
      {
        if (error?.name === 'RenderingCancelledException')
        {
          return;
        }

        setPdfError('Unable to render this page. Try another file or page number.');
      } finally
      {
        if (!isCancelled)
        {
          setIsRendering(false);
        }
      }
    };

    renderPdfPage();

    return () =>
    {
      isCancelled = true;

      if (renderTaskRef.current)
      {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (textLayerTaskRef.current)
      {
        textLayerTaskRef.current.cancel();
        textLayerTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNumber, zoom]);

  // Persist page number whenever it changes
  useEffect(() =>
  {
    if (pdfDoc && pdfName && pageNumber)
    {
      saveSession(pdfName, pageNumber).catch(() => { });
    }
  }, [pdfDoc, pdfName, pageNumber]);

  const handlePdfUpload = async (event) =>
  {
    const file = event.target.files?.[0];
    if (!file)
    {
      return;
    }

    setPdfError('');

    try
    {
      const buffer = await file.arrayBuffer();
      const loadedPdf = await getDocument({ data: buffer }).promise;
      const session = await loadSession(file.name);
      const savedPage = session ? session.pageNumber : 1;
      const startPage = Math.min(Math.max(1, savedPage), loadedPdf.numPages);
      setPdfDoc(loadedPdf);
      setPdfName(file.name);
      setTotalPages(loadedPdf.numPages);
      setPageNumber(startPage);
      setJumpPage(String(startPage));
    } catch
    {
      setPdfDoc(null);
      setTotalPages(0);
      setPdfError('Could not open this PDF. Please choose a valid PDF file.');
    }
  };

  const goToPage = () =>
  {
    if (!pdfDoc || !totalPages)
    {
      return;
    }

    const targetPage = Number.parseInt(jumpPage, 10);
    if (!Number.isInteger(targetPage) || targetPage < 1 || targetPage > totalPages)
    {
      setPdfError(`Enter a page between 1 and ${totalPages}.`);
      return;
    }

    setPdfError('');
    setPageNumber(targetPage);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Study Workspace</p>
          <h1>Chess PDF Reader</h1>
          <p className="subtext">Optimized for side-by-side use with Chessvision.ai.</p>
        </div>
      </header>

      <section className="layout">
        <article className="card pdf-panel">
          <div className="panel-header">
            <h2>PDF Viewer</h2>
            <label className="upload-btn" htmlFor="pdfUpload">
              Load PDF
            </label>
            <input
              id="pdfUpload"
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              className="hidden-input"
            />
          </div>

          <p className="file-name">{pdfName || 'No file selected'}</p>

          <div className="pdf-canvas-wrap" ref={pdfScrollRef}>
            {isRendering && <p className="overlay-message">Rendering page…</p>}
            {!pdfDoc && !pdfError && <p className="overlay-message">Upload a PDF to start reading.</p>}
            {pdfError && <p className="error-message">{pdfError}</p>}
            <div className="pdf-page">
              <canvas ref={canvasRef} className="pdf-canvas" />
              <div ref={textLayerRef} className="textLayer text-layer" />
            </div>
          </div>

          <div className="controls-row bottom-controls">
            <button onClick={() => { setPageNumber((page) => Math.max(1, page - 1)); sendGtagEvent('page_prev', { page: pageNumber - 1 }); }} disabled={!pdfDoc || pageNumber <= 1}>
              Prev
            </button>
            <span className="page-status">
              Page {pageNumber} / {totalPages || 0}
            </span>
            <button
              onClick={() => { setPageNumber((page) => Math.min(totalPages, page + 1)); sendGtagEvent('page_next', { page: pageNumber + 1 }); }}
              disabled={!pdfDoc || pageNumber >= totalPages}
            >
              Next
            </button>
            <input
              type="number"
              className="page-input"
              min={1}
              max={totalPages || 1}
              value={jumpPage}
              onChange={(event) => setJumpPage(event.target.value)}
              onKeyDown={(event) =>
              {
                if (event.key === 'Enter')
                {
                  goToPage();
                }
              }}
              placeholder="Page #"
              disabled={!pdfDoc}
            />
            <button onClick={() => { goToPage(); sendGtagEvent('go_to_page', { page: jumpPage }); }} disabled={!pdfDoc}>Go</button>
            <button onClick={() => { setZoom((current) => { const v = Math.max(0.7, current - 0.1); sendGtagEvent('zoom_change', { zoom: v }); return v; }); }} disabled={!pdfDoc}>
              -
            </button>
            <span className="zoom-status">{Math.round(zoom * 100)}%</span>
            <button onClick={() => { setZoom((current) => { const v = Math.min(2.4, current + 0.1); sendGtagEvent('zoom_change', { zoom: v }); return v; }); }} disabled={!pdfDoc}>
              +
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

export default App;
